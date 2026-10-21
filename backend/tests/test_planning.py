from datetime import date
from decimal import Decimal

import pytest

from app import planning as p
from app.planning import Status

D = Decimal


def test_monthly_rate_compounds_to_annual():
    assert (1 + p.monthly_rate(5.0)) ** 12 == pytest.approx(1.05)
    assert p.monthly_rate(0) == 0


def test_required_monthly_zero_rate_is_linear():
    assert p.required_monthly(D(0), D(12000), 12, 0) == D("1000.00")
    assert p.required_monthly(D(2000), D(12000), 10, 0) == D("1000.00")


def test_required_monthly_matches_annuity_formula():
    # 10,000 -> 100,000 in 10 years @ 6%: known-good value from the annuity formula
    pmt = p.required_monthly(D(10000), D(100000), 120, 6.0)
    assert p.future_value(D(10000), pmt, 120, 6.0) == pytest.approx(D(100000), abs=D("1.00"))


@pytest.mark.parametrize("rate", [0, 2.5, 5, 12])
@pytest.mark.parametrize("months", [1, 7, 60, 360])
def test_required_monthly_roundtrips_with_future_value(rate, months):
    target = D(50000)
    pmt = p.required_monthly(D(1000), target, months, rate)
    fv = p.future_value(D(1000), pmt, months, rate)
    # The deposit is rounded to the cent (error <= 0.5c), and that error compounds through
    # the annuity factor, so the tolerance is half a cent times that factor (plus rounding).
    r = p.monthly_rate(rate)
    factor = months if r == 0 else ((1 + r) ** months - 1) / r
    assert abs(fv - target) <= D(str(0.005 * factor)) + D("0.02")


def test_required_monthly_already_reached_is_zero():
    assert p.required_monthly(D(500), D(500), 12, 5) == D("0.00")
    assert p.required_monthly(D(900), D(500), 12, 5) == D("0.00")


def test_required_monthly_no_time_left_is_lump_sum():
    assert p.required_monthly(D(100), D(1000), 0, 5) == D("900.00")


def test_higher_return_means_lower_deposit():
    assert p.required_monthly(D(0), D(100000), 120, 8) < p.required_monthly(D(0), D(100000), 120, 2)


def test_months_between_and_left():
    assert p.months_between(date(2025, 1, 15), date(2025, 3, 15)) == 2
    assert p.months_between(date(2025, 1, 15), date(2025, 3, 14)) == 1
    assert p.months_left(date(2025, 1, 1), date(2025, 1, 2)) == 1  # at least one month
    assert p.months_left(date(2025, 1, 1), date(2025, 1, 1)) == 0
    assert p.months_left(date(2025, 2, 1), date(2025, 1, 1)) == 0


def test_add_months_clamps_day():
    assert p.add_months(date(2025, 1, 31), 1) == date(2025, 2, 28)
    assert p.add_months(date(2024, 1, 31), 1) == date(2024, 2, 29)
    assert p.add_months(date(2025, 11, 30), 3) == date(2026, 2, 28)


def test_months_to_reach():
    assert p.months_to_reach(D(0), D(1200), D(100), 0) == 12
    assert p.months_to_reach(D(1200), D(1200), D(0), 0) == 0
    assert p.months_to_reach(D(0), D(1200), D(0), 0) is None
    assert p.months_to_reach(D(0), D(2400), D(100), 0) == 24
    assert p.months_to_reach(D(0), D(2400), D(100), 6) < 24  # growth helps


def test_progress_pct_caps_and_handles_zero_target():
    assert p.progress_pct(D(50), D(200)) == 25.0
    assert p.progress_pct(D(500), D(200)) == 100.0
    assert p.progress_pct(D(5), D(0)) == 0.0


def _eval(current, today, **kw):
    base = dict(
        today=today,
        current=D(current),
        target=D(12000),
        target_date=date(2026, 1, 1),
        annual_pct=0,
        plan_start_date=date(2025, 1, 1),
        plan_start_amount=D(0),
    )
    base.update(kw)
    return p.evaluate(**base)


def test_evaluate_statuses():
    mid = date(2025, 7, 1)  # 6 of 12 months elapsed -> expected 6000 at 0%
    assert _eval(6000, mid).status == Status.ON_TRACK
    assert _eval(5800, mid).status == Status.ON_TRACK  # within 5%
    assert _eval(5000, mid).status == Status.AT_RISK
    assert _eval(2000, mid).status == Status.OFF_TRACK
    assert _eval(12000, mid).status == Status.COMPLETED
    assert _eval(13000, mid).status == Status.COMPLETED
    assert _eval(0, date(2025, 1, 1)).status == Status.ON_TRACK  # day one
    assert _eval(100, date(2026, 2, 1)).status == Status.OFF_TRACK  # overdue


def test_projection_tunnel_ordering_and_endpoints():
    proj = p.build_projection(
        today=date(2025, 1, 1),
        current=D(1000),
        target=D(20000),
        target_date=date(2027, 1, 1),
        annual_pct=5,
    )
    pts = proj["points"]
    assert proj["months"] == 24 and len(pts) == 25
    assert pts[0]["expected"] == D("1000.00")
    assert pts[-1]["expected"] == pytest.approx(D(20000), abs=D("1"))
    assert all(pt["low"] <= pt["expected"] <= pt["high"] for pt in pts)
    assert all(pt["no_deposits"] <= pt["expected"] for pt in pts)
