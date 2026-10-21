from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.config import get_settings
from app.deps import CurrentUser, DbDep, unauthorized
from app.models import Contribution, Goal, User
from app.ratelimit import rate_limit
from app.schemas import (
    ChangePasswordIn,
    DeleteAccountIn,
    LoginIn,
    RegisterIn,
    TokenOut,
    UserOut,
)
from app.security import (
    DUMMY_HASH,
    InvalidToken,
    create_token,
    decode_token,
    hash_password,
    password_needs_rehash,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE = "planit_refresh"
GENERIC_LOGIN_ERROR = "Incorrect e-mail or password"


def _set_refresh_cookie(response: Response, user: User) -> None:
    s = get_settings()
    response.set_cookie(
        REFRESH_COOKIE,
        create_token(user.id, user.token_version, "refresh"),
        max_age=s.refresh_token_days * 86400,
        httponly=True,  # not readable from JavaScript -> XSS can't steal it
        secure=s.cookie_secure,
        samesite="lax",
        path="/auth",  # only sent to the auth endpoints
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(REFRESH_COOKIE, path="/auth")


def _token_response(response: Response, user: User) -> TokenOut:
    _set_refresh_cookie(response, user)
    return TokenOut(access_token=create_token(user.id, user.token_version, "access"))


def _check_origin(request: Request) -> None:
    """CSRF defence in depth for cookie-authenticated endpoints: reject foreign Origins."""
    origin = request.headers.get("origin")
    if origin is not None and origin not in get_settings().cors_origins:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Origin not allowed")


@router.post(
    "/register",
    response_model=TokenOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit("register", 5, 60))],
)
def register(body: RegisterIn, response: Response, db: DbDep) -> TokenOut:
    local = body.email.split("@")[0]
    if body.password.lower() == body.email or (len(local) >= 4 and local in body.password.lower()):
        raise HTTPException(422, "Password is too similar to e-mail")
    user = User(email=body.email, password_hash=hash_password(body.password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "E-mail already registered") from None
    return _token_response(response, user)


@router.post("/login", response_model=TokenOut, dependencies=[Depends(rate_limit("login", 10, 60))])
def login(body: LoginIn, response: Response, db: DbDep) -> TokenOut:
    s = get_settings()
    now = datetime.now(UTC)
    user = db.scalar(select(User).where(User.email == body.email))

    if user is None:
        verify_password(DUMMY_HASH, body.password)  # equalise timing
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, GENERIC_LOGIN_ERROR)

    locked = user.locked_until
    if locked is not None:
        locked = locked if locked.tzinfo else locked.replace(tzinfo=UTC)
        if locked > now:
            # same message as a wrong password: don't reveal that the account exists/is locked
            verify_password(DUMMY_HASH, body.password)
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                "Too many failed attempts, try again later",
                headers={"Retry-After": str(s.lockout_minutes * 60)},
            )

    if not verify_password(user.password_hash, body.password):
        user.failed_logins += 1
        if user.failed_logins >= s.max_failed_logins:
            user.locked_until = now + timedelta(minutes=s.lockout_minutes)
            user.failed_logins = 0
        db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, GENERIC_LOGIN_ERROR)

    user.failed_logins = 0
    user.locked_until = None
    if password_needs_rehash(user.password_hash):
        user.password_hash = hash_password(body.password)
    db.commit()
    return _token_response(response, user)


@router.post("/refresh", response_model=TokenOut, dependencies=[Depends(rate_limit("refresh", 30, 60))])
def refresh(
    request: Request,
    response: Response,
    db: DbDep,
    planit_refresh: Annotated[str | None, Cookie()] = None,
) -> TokenOut:
    _check_origin(request)
    if not planit_refresh:
        raise unauthorized()
    try:
        claims = decode_token(planit_refresh, "refresh")
        user = db.get(User, int(claims["sub"]))
    except (InvalidToken, ValueError):
        raise unauthorized() from None
    if user is None or user.token_version != claims["ver"]:
        _clear_refresh_cookie(response)
        raise unauthorized()
    return _token_response(response, user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response) -> None:
    _check_origin(request)
    _clear_refresh_cookie(response)


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT)
def logout_all(request: Request, response: Response, user: CurrentUser, db: DbDep) -> None:
    _check_origin(request)
    user.token_version += 1
    db.commit()
    _clear_refresh_cookie(response)


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser) -> User:
    return user


@router.post(
    "/change-password",
    response_model=TokenOut,
    dependencies=[Depends(rate_limit("change-password", 5, 60))],
)
def change_password(body: ChangePasswordIn, response: Response, user: CurrentUser, db: DbDep) -> TokenOut:
    if not verify_password(user.password_hash, body.current_password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")
    user.password_hash = hash_password(body.new_password)
    user.token_version += 1  # every other session is signed out
    db.commit()
    return _token_response(response, user)


@router.delete(
    "/me",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(rate_limit("delete-account", 5, 60))],
)
def delete_account(body: DeleteAccountIn, response: Response, user: CurrentUser, db: DbDep) -> None:
    if not verify_password(user.password_hash, body.password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Password is incorrect")
    # Explicit deletes so it also works on SQLite without foreign-key enforcement.
    goal_ids = db.scalars(select(Goal.id).where(Goal.user_id == user.id)).all()
    if goal_ids:
        db.query(Contribution).filter(Contribution.goal_id.in_(goal_ids)).delete(
            synchronize_session=False
        )
        db.query(Goal).filter(Goal.user_id == user.id).delete(synchronize_session=False)
    db.delete(user)
    db.commit()
    _clear_refresh_cookie(response)


@router.get("/export")
def export_data(user: CurrentUser) -> dict:
    """Everything we store about the user (data-portability / privacy-law requests)."""
    return {
        "user": {"id": user.id, "email": user.email, "created_at": user.created_at.isoformat()},
        "goals": [
            {
                "id": g.id,
                "title": g.title,
                "target_amount": str(g.target_amount),
                "initial_amount": str(g.initial_amount),
                "target_date": g.target_date.isoformat(),
                "annual_return_pct": g.annual_return_pct,
                "created_at": g.created_at.isoformat(),
                "contributions": [
                    {"amount": str(c.amount), "date": c.date.isoformat(), "note": c.note}
                    for c in g.contributions
                ],
            }
            for g in user.goals
        ],
    }
