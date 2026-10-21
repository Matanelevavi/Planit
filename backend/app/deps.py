from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.security import InvalidToken, decode_token

_bearer = HTTPBearer(auto_error=False)
DbDep = Annotated[Session, Depends(get_db)]


def unauthorized() -> HTTPException:
    return HTTPException(
        status.HTTP_401_UNAUTHORIZED,
        "Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    db: DbDep,
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User:
    if creds is None:
        raise unauthorized()
    try:
        claims = decode_token(creds.credentials, "access")
        user = db.get(User, int(claims["sub"]))
    except (InvalidToken, ValueError):
        raise unauthorized() from None
    if user is None or user.token_version != claims["ver"]:
        raise unauthorized()
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
