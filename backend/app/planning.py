"""Pure financial-planning maths (no I/O). Money is Decimal, quantized to cents on output.

Conventions: `annual_pct` is a percentage (5.0 == 5%). Contributions are made at the END of
each month (ordinary annuity). The monthly rate is the compounding-equivalent of the annual one.
"""

from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from enum import StrEnum

CENT = Decimal("0.01")
MAX_MONTHS = 1200  # 100 years, hard stop for any iterative search


class Status(StrEnum):
    COMPLETED = "completed"
    ON_TRACK = "on_track"
    AT_RISK = "at_risk"
    OFF_TRACK = "off_track"


def money(x: Decimal | float | int) -> Decimal:
    return Decimal(x).quantize(CENT, rounding=ROUND_HALF_UP)


def monthly_rate(annual_pct: float) -> float:
    return (1.0 + annual_pct / 100.0) ** (1.0 / 12.0) - 1.0


def months_between(start: date, end: date) -> int:
    """Whole months from `start` to `end` (negative if end < start)."""
    months = (end.year - start.year) * 12 + (end.month - start.month)
    if end.day < start.day:
        months -= 1
    return months


def months_left(today: date, target: date) -> int:
    """Months remaining until target; at least 1 while the target is still in the future."""
    if target <= today:
        return 0
    return max(1, months_between(today, target))


def add_months(d: date, n: int) -> date:
    y, m = divmod(d.year * 12 + (d.month - 1) + n, 12)
    m += 1
    # clamp the day to the length of the target month
    for day in (d.day, 30, 29, 28):
        try:
            return date(y, m, day)
        except ValueError:
            continue
    raise AssertionError("unreachable")


def future_value(present: Decimal, monthly: Decimal, months: int, annual_pct: float) -> Decimal:
    """Balance after `months` of compounding with end-of-month deposits."""
    if months <= 0:
        return money(present)
    r = monthly_rate(annual_pct)
    p, d = float(present), float(monthly)
    if r == 0:
        return money(p + d * months)
    growth = (1 + r) ** months
    return money(p * growth + d * (growth - 1) / r)


def required_monthly(
    current: Decimal, target: Decimal, months: int, annual_pct: float
) -> Decimal:
    """Deposit per month needed to turn `current` into `target` in `months` (>= 0)."""
    if current >= target:
        return Decimal("0.00")
    if months <= 0:
        return money(target - current)  # nothing left but a lump sum
    r = monthly_rate(annual_pct)
    c, t = float(current), float(target)
    if r == 0:
        pmt = (t - c) / months
    else:
        growth = (1 + r) ** months
        pmt = (t - c * growth) * r / (growth - 1)
    return money(max(pmt, 0.0))


def months_to_reach(
    current: Decimal, target: Decimal, monthly: Decimal, annual_pct: float
) -> int | None:
    """Months until balance >= target with a fixed deposit, or None if never within MAX_MONTHS."""
    if current >= target:
        return 0
    r = monthly_rate(annual_pct)
    bal, d, t = float(current), float(monthly), float(target)
    for n in range(1, MAX_MONTHS + 1):
        bal = bal * (1 + r) + d
        if bal >= t:
            return n
    return None


@dataclass(frozen=True)
class PlanState:
    status: Status
    expected_now: Decimal
    progress_pct: float


def progress_pct(current: Decimal, target: Decimal) -> float:
    if target <= 0:
        return 0.0
    return round(min(float(current / target) * 100.0, 100.0), 1)


def evaluate(
    *,
    today: date,
    current: Decimal,
    target: Decimal,
    target_date: date,
    annual_pct: float,
    plan_start_date: date,
    plan_start_amount: Decimal,
) -> PlanState:
    """Compare where the user is with where the plan said they would be today."""
    pct = progress_pct(current, target)
    if current >= target:
        return PlanState(Status.COMPLETED, money(target), 100.0)

    plan_months = max(months_between(plan_start_date, target_date), 1)
    planned_pmt = required_monthly(plan_start_amount, target, plan_months, annual_pct)
    elapsed = max(months_between(plan_start_date, today), 0)
    expected = future_value(plan_start_amount, planned_pmt, elapsed, annual_pct)

    if target_date <= today:
        return PlanState(Status.OFF_TRACK, expected, pct)
    if elapsed == 0 or expected <= 0:
        return PlanState(Status.ON_TRACK, expected, pct)

    ratio = float(current / expected)
    if ratio >= 0.95:
        status = Status.ON_TRACK
    elif ratio >= 0.80:
        status = Status.AT_RISK
    else:
        status = Status.OFF_TRACK
    return PlanState(status, expected, pct)


def build_projection(
    *,
    today: date,
    current: Decimal,
    target: Decimal,
    target_date: date,
    annual_pct: float,
    band_pct: float = 2.0,
) -> dict:
    """Month-by-month "tunnel": expected path plus pessimistic/optimistic return bands."""
    n = months_left(today, target_date)
    pmt = required_monthly(current, target, n, annual_pct)
    low_rate = max(annual_pct - band_pct, 0.0)
    high_rate = annual_pct + band_pct
    points = []
    for i in range(0, n + 1):
        points.append(
            {
                "month": i,
                "date": add_months(today, i).isoformat(),
                "expected": future_value(current, pmt, i, annual_pct),
                "low": future_value(current, pmt, i, low_rate),
                "high": future_value(current, pmt, i, high_rate),
                "no_deposits": future_value(current, Decimal("0"), i, annual_pct),
            }
        )
    return {"months": n, "required_monthly": pmt, "points": points}
