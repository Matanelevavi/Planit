from datetime import date
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy import func, select

from app import planning
from app.config import get_settings
from app.deps import CurrentUser, DbDep
from app.models import Contribution, Goal
from app.planning import money
from app.schemas import (
    ContributionCreate,
    ContributionOut,
    GoalCreate,
    GoalOut,
    GoalUpdate,
    SummaryOut,
)

router = APIRouter(prefix="/goals", tags=["goals"])


def _goal_or_404(db: DbDep, user: CurrentUser, goal_id: int) -> Goal:
    # Ownership is part of the query: someone else's goal is indistinguishable from a missing one.
    goal = db.scalar(select(Goal).where(Goal.id == goal_id, Goal.user_id == user.id))
    if goal is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Goal not found")
    return goal


def to_out(goal: Goal, today: date | None = None) -> GoalOut:
    today = today or date.today()
    current = goal.current_amount
    state = planning.evaluate(
        today=today,
        current=current,
        target=goal.target_amount,
        target_date=goal.target_date,
        annual_pct=goal.annual_return_pct,
        plan_start_date=goal.plan_start_date,
        plan_start_amount=goal.plan_start_amount,
    )
    months = planning.months_left(today, goal.target_date)
    return GoalOut(
        id=goal.id,
        title=goal.title,
        target_amount=money(goal.target_amount),
        current_amount=money(current),
        target_date=goal.target_date,
        annual_return_pct=goal.annual_return_pct,
        progress_pct=state.progress_pct,
        months_left=months,
        status=state.status,
        expected_now=state.expected_now,
        suggestion_monthly_deposit=planning.required_monthly(
            current, goal.target_amount, months, goal.annual_return_pct
        ),
        created_at=goal.created_at,
    )


@router.get("/", response_model=list[GoalOut])
def list_goals(user: CurrentUser, db: DbDep) -> list[GoalOut]:
    goals = db.scalars(select(Goal).where(Goal.user_id == user.id).order_by(Goal.target_date, Goal.id))
    return [to_out(g) for g in goals]


@router.get("/summary", response_model=SummaryOut)
def summary(user: CurrentUser, db: DbDep) -> SummaryOut:
    outs = [to_out(g) for g in db.scalars(select(Goal).where(Goal.user_id == user.id))]
    counts = {s.value: 0 for s in planning.Status}
    for o in outs:
        counts[o.status.value] += 1
    open_goals = [o for o in outs if o.status != planning.Status.COMPLETED]
    # worst = furthest behind its own plan
    worst = min(
        (o for o in open_goals if o.expected_now > 0),
        key=lambda o: o.current_amount / o.expected_now,
        default=None,
    )
    return SummaryOut(
        goal_count=len(outs),
        total_target=sum((o.target_amount for o in outs), Decimal("0.00")),
        total_current=sum((o.current_amount for o in outs), Decimal("0.00")),
        total_required_monthly=sum((o.suggestion_monthly_deposit for o in open_goals), Decimal("0.00")),
        status_counts=counts,
        most_at_risk_goal_id=worst.id if worst and worst.status != planning.Status.ON_TRACK else None,
    )


@router.post("/", response_model=GoalOut, status_code=status.HTTP_201_CREATED)
def create_goal(body: GoalCreate, user: CurrentUser, db: DbDep) -> GoalOut:
    count = db.scalar(select(func.count()).select_from(Goal).where(Goal.user_id == user.id))
    if count >= get_settings().max_goals_per_user:
        raise HTTPException(status.HTTP_409_CONFLICT, "Goal limit reached")
    goal = Goal(
        user_id=user.id,
        title=body.title,
        target_amount=body.target_amount,
        initial_amount=body.current_amount,
        target_date=body.target_date,
        annual_return_pct=body.annual_return_pct,
        plan_start_date=date.today(),
        plan_start_amount=body.current_amount,
    )
    db.add(goal)
    db.commit()
    return to_out(goal)


@router.get("/{goal_id}", response_model=GoalOut)
def get_goal(goal_id: int, user: CurrentUser, db: DbDep) -> GoalOut:
    return to_out(_goal_or_404(db, user, goal_id))


@router.patch("/{goal_id}", response_model=GoalOut)
@router.put("/{goal_id}", response_model=GoalOut, include_in_schema=False)  # legacy UI
def update_goal(goal_id: int, body: GoalUpdate, user: CurrentUser, db: DbDep) -> GoalOut:
    goal = _goal_or_404(db, user, goal_id)
    data = body.model_dump(exclude_unset=True)
    today = date.today()

    new_balance = data.pop("current_amount", None)
    if new_balance is not None:
        delta = new_balance - goal.current_amount
        if delta != 0:
            goal.contributions.append(
                Contribution(amount=delta, date=today, note="Balance adjustment")
            )

    plan_changed = False
    for field in ("title", "target_amount", "target_date", "annual_return_pct"):
        if field in data and data[field] is not None:
            if field != "title" and getattr(goal, field) != data[field]:
                plan_changed = True
            setattr(goal, field, data[field])

    if plan_changed:  # a new target/date/return means a new plan, measured from today's balance
        goal.plan_start_date = today
        goal.plan_start_amount = goal.current_amount

    db.commit()
    return to_out(goal)


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(goal_id: int, user: CurrentUser, db: DbDep) -> Response:
    goal = _goal_or_404(db, user, goal_id)
    db.delete(goal)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------- contributions ----------
@router.get("/{goal_id}/contributions", response_model=list[ContributionOut])
def list_contributions(goal_id: int, user: CurrentUser, db: DbDep) -> list[Contribution]:
    return list(reversed(_goal_or_404(db, user, goal_id).contributions))


@router.post(
    "/{goal_id}/contributions", response_model=GoalOut, status_code=status.HTTP_201_CREATED
)
def add_contribution(goal_id: int, body: ContributionCreate, user: CurrentUser, db: DbDep) -> GoalOut:
    goal = _goal_or_404(db, user, goal_id)
    if goal.current_amount + body.amount < 0:
        raise HTTPException(422, "Balance cannot go below zero")
    if len(goal.contributions) >= 10_000:
        raise HTTPException(status.HTTP_409_CONFLICT, "Too many entries for this goal")
    goal.contributions.append(
        Contribution(amount=body.amount, date=body.date or date.today(), note=body.note)
    )
    db.commit()
    return to_out(goal)


@router.delete("/{goal_id}/contributions/{contribution_id}", response_model=GoalOut)
def delete_contribution(goal_id: int, contribution_id: int, user: CurrentUser, db: DbDep) -> GoalOut:
    goal = _goal_or_404(db, user, goal_id)
    entry = next((c for c in goal.contributions if c.id == contribution_id), None)
    if entry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Entry not found")
    if goal.current_amount - entry.amount < 0:
        raise HTTPException(422, "Balance cannot go below zero")
    goal.contributions.remove(entry)
    db.commit()
    return to_out(goal)


# ---------- projections ----------
@router.get("/{goal_id}/projection")
def projection(goal_id: int, user: CurrentUser, db: DbDep) -> dict:
    goal = _goal_or_404(db, user, goal_id)
    today = date.today()
    proj = planning.build_projection(
        today=today,
        current=goal.current_amount,
        target=goal.target_amount,
        target_date=goal.target_date,
        annual_pct=goal.annual_return_pct,
    )
    history, running = [], goal.initial_amount
    history.append({"date": goal.plan_start_date.isoformat(), "balance": money(running)})
    for c in goal.contributions:
        running += c.amount
        history.append({"date": c.date.isoformat(), "balance": money(running)})
    return {**proj, "history": history}


@router.get("/{goal_id}/what-if")
def what_if(
    goal_id: int,
    user: CurrentUser,
    db: DbDep,
    monthly: Decimal = Query(ge=0, le=1_000_000, max_digits=10, decimal_places=2),
    annual_return_pct: float | None = Query(default=None, ge=0, le=20),
) -> dict:
    goal = _goal_or_404(db, user, goal_id)
    rate = goal.annual_return_pct if annual_return_pct is None else annual_return_pct
    today = date.today()
    months = planning.months_left(today, goal.target_date)
    current = goal.current_amount
    reach = planning.months_to_reach(current, goal.target_amount, monthly, rate)
    return {
        "monthly": money(monthly),
        "annual_return_pct": rate,
        "balance_at_target_date": planning.future_value(current, monthly, months, rate),
        "target_amount": money(goal.target_amount),
        "reaches_target": reach is not None and reach <= months,
        "months_to_reach": reach,
        "reach_date": planning.add_months(today, reach).isoformat() if reach is not None else None,
        "required_monthly": planning.required_monthly(current, goal.target_amount, months, rate),
    }
