from datetime import date as Date
from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    StringConstraints,
    field_validator,
)

from app.planning import Status

MAX_AMOUNT = Decimal("1000000000")  # 1 billion
MAX_HORIZON_YEARS = 60

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
Money = Annotated[Decimal, Field(max_digits=14, decimal_places=2)]
PositiveMoney = Annotated[Decimal, Field(gt=0, le=MAX_AMOUNT, max_digits=14, decimal_places=2)]
NonNegMoney = Annotated[Decimal, Field(ge=0, le=MAX_AMOUNT, max_digits=14, decimal_places=2)]
ReturnPct = Annotated[float, Field(ge=0, le=20)]


def _validate_password(pw: str) -> str:
    if len(pw) < 10:
        raise ValueError("Password must be at least 10 characters")
    if len(pw) > 128:
        raise ValueError("Password must be at most 128 characters")
    if pw.isdigit() or pw.isalpha():
        raise ValueError("Password must mix letters with digits or symbols")
    return pw


# ---------- auth ----------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def _pw(cls, v: str) -> str:
        return _validate_password(v)

    @field_validator("email")
    @classmethod
    def _lower(cls, v: str) -> str:
        return v.strip().lower()


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(max_length=128)

    @field_validator("email")
    @classmethod
    def _lower(cls, v: str) -> str:
        return v.strip().lower()


class ChangePasswordIn(BaseModel):
    current_password: str = Field(max_length=128)
    new_password: str

    @field_validator("new_password")
    @classmethod
    def _pw(cls, v: str) -> str:
        return _validate_password(v)


class DeleteAccountIn(BaseModel):
    password: str = Field(max_length=128)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    created_at: datetime


# ---------- goals ----------
def _check_future(d: Date) -> Date:
    today = Date.today()
    if d <= today:
        raise ValueError("Target date must be in the future")
    if (d - today).days > MAX_HORIZON_YEARS * 366:
        raise ValueError(f"Target date must be within {MAX_HORIZON_YEARS} years")
    return d


class GoalCreate(BaseModel):
    title: Title
    target_amount: PositiveMoney
    current_amount: NonNegMoney = Decimal("0")
    target_date: Date
    annual_return_pct: ReturnPct = 5.0

    @field_validator("target_date")
    @classmethod
    def _future(cls, v: Date) -> Date:
        return _check_future(v)


class GoalUpdate(BaseModel):
    title: Title | None = None
    target_amount: PositiveMoney | None = None
    current_amount: NonNegMoney | None = None
    target_date: Date | None = None
    annual_return_pct: ReturnPct | None = None

    @field_validator("target_date")
    @classmethod
    def _future(cls, v: Date | None) -> Date | None:
        return None if v is None else _check_future(v)


class GoalOut(BaseModel):
    id: int
    title: str
    target_amount: Decimal
    current_amount: Decimal
    target_date: Date
    annual_return_pct: float
    progress_pct: float
    months_left: int
    status: Status
    expected_now: Decimal
    # Name kept for backwards compatibility with the first Planit UI.
    suggestion_monthly_deposit: Decimal
    created_at: datetime


class ContributionCreate(BaseModel):
    amount: Money
    date: Date | None = None
    note: Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)] = ""

    @field_validator("amount")
    @classmethod
    def _amount(cls, v: Decimal) -> Decimal:
        if v == 0:
            raise ValueError("Amount must not be zero")
        if abs(v) > MAX_AMOUNT:
            raise ValueError("Amount is too large")
        return v

    @field_validator("date")
    @classmethod
    def _date(cls, v: Date | None) -> Date | None:
        if v is None:
            return v
        if v > Date.today():
            raise ValueError("Contribution date cannot be in the future")
        if v < Date(2000, 1, 1):
            raise ValueError("Contribution date is too far in the past")
        return v


class ContributionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    amount: Decimal
    date: Date
    note: str


class SummaryOut(BaseModel):
    goal_count: int
    total_target: Decimal
    total_current: Decimal
    total_required_monthly: Decimal
    status_counts: dict[str, int]
    most_at_risk_goal_id: int | None

