from datetime import date, timedelta
from decimal import Decimal

import pytest

from tests.conftest import auth, goal_payload, register


def make_goal(client, headers, **over):
    r = client.post("/goals/", json=goal_payload(**over), headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def test_create_and_read_goal(client, headers):
    g = make_goal(client, headers)
    assert g["title"] == "Apartment"
    assert Decimal(g["suggestion_monthly_deposit"]) > 0
    assert g["status"] == "on_track" and g["progress_pct"] == 0
    assert client.get(f"/goals/{g['id']}", headers=headers).json()["id"] == g["id"]
    assert len(client.get("/goals/", headers=headers).json()) == 1


def test_title_is_trimmed(client, headers):
    assert make_goal(client, headers, title="   House  ")["title"] == "House"


@pytest.mark.parametrize(
    "over",
    [
        {"title": ""},
        {"title": "   "},
        {"title": "x" * 101},
        {"target_amount": "0"},
        {"target_amount": "-5"},
        {"target_amount": "abc"},
        {"target_amount": "99999999999"},
        {"current_amount": "-1"},
        {"target_date": date.today().isoformat()},
        {"target_date": "2000-01-01"},
        {"target_date": "4332-03-02"},
        {"target_date": "not-a-date"},
        {"annual_return_pct": -1},
        {"annual_return_pct": 50},
        {"target_amount": "10.123"},
    ],
)
def test_invalid_goal_rejected(client, headers, over):
    assert client.post("/goals/", json=goal_payload(**over), headers=headers).status_code == 422


def test_html_in_title_is_stored_verbatim_not_executed(client, headers):
    # The API returns JSON and React escapes on render; nothing is interpreted server-side.
    g = make_goal(client, headers, title="<script>alert(1)</script>")
    assert g["title"] == "<script>alert(1)</script>"


def test_sql_injection_strings_are_inert(client, headers):
    make_goal(client, headers, title="'; DROP TABLE goals; --")
    assert len(client.get("/goals/", headers=headers).json()) == 1


def test_goal_limit(client, headers, settings):
    settings.max_goals_per_user = 2
    make_goal(client, headers)
    make_goal(client, headers)
    assert client.post("/goals/", json=goal_payload(), headers=headers).status_code == 409


def test_users_cannot_see_or_touch_each_others_goals(client, headers):
    gid = make_goal(client, headers)["id"]
    other = auth(register(client, "other@example.com"))

    assert client.get("/goals/", headers=other).json() == []
    for method, path, body in [
        ("get", f"/goals/{gid}", None),
        ("patch", f"/goals/{gid}", {"title": "hacked"}),
        ("delete", f"/goals/{gid}", None),
        ("get", f"/goals/{gid}/contributions", None),
        ("post", f"/goals/{gid}/contributions", {"amount": "10"}),
        ("get", f"/goals/{gid}/projection", None),
        ("get", f"/goals/{gid}/what-if?monthly=100", None),
    ]:
        r = client.request(method, path, headers=other, **({"json": body} if body else {}))
        assert r.status_code == 404, (method, path, r.status_code)
    assert client.get(f"/goals/{gid}", headers=headers).json()["title"] == "Apartment"


def test_cannot_inject_user_id_or_balance_fields(client, headers):
    r = client.post("/goals/", json=goal_payload(user_id=999, initial_amount="1000000", id=77), headers=headers)
    assert r.status_code == 201
    assert r.json()["id"] != 77 and Decimal(r.json()["current_amount"]) == 0


def test_update_title_keeps_plan_baseline(client, headers):
    g = make_goal(client, headers)
    u = client.patch(f"/goals/{g['id']}", json={"title": "New name"}, headers=headers).json()
    assert u["title"] == "New name" and u["suggestion_monthly_deposit"] == g["suggestion_monthly_deposit"]


def test_update_balance_records_adjustment(client, headers):
    g = make_goal(client, headers)
    u = client.put(f"/goals/{g['id']}", json={"current_amount": "5000"}, headers=headers).json()
    assert Decimal(u["current_amount"]) == 5000
    assert u["progress_pct"] == pytest.approx(4.2, abs=0.1)
    entries = client.get(f"/goals/{g['id']}/contributions", headers=headers).json()
    assert len(entries) == 1 and entries[0]["note"] == "Balance adjustment"
    # lowering the balance is allowed and recorded as a negative adjustment
    u2 = client.patch(f"/goals/{g['id']}", json={"current_amount": "3000"}, headers=headers).json()
    assert Decimal(u2["current_amount"]) == 3000


def test_update_rejects_bad_values(client, headers):
    gid = make_goal(client, headers)["id"]
    for body in [{"current_amount": "-1"}, {"target_amount": "0"}, {"target_date": "2001-01-01"}, {"title": ""}]:
        assert client.patch(f"/goals/{gid}", json=body, headers=headers).status_code == 422


def test_changing_target_resets_the_plan_baseline(client, headers):
    gid = make_goal(client, headers)["id"]
    client.post(f"/goals/{gid}/contributions", json={"amount": "1000"}, headers=headers)
    u = client.patch(f"/goals/{gid}", json={"target_amount": "50000"}, headers=headers).json()
    assert u["status"] == "on_track"
    assert Decimal(u["expected_now"]) == Decimal("1000.00")  # new plan starts at today's balance


def test_delete_goal(client, headers):
    gid = make_goal(client, headers)["id"]
    assert client.delete(f"/goals/{gid}", headers=headers).status_code == 204
    assert client.get(f"/goals/{gid}", headers=headers).status_code == 404


def test_unknown_goal_is_404(client, headers):
    assert client.get("/goals/9999", headers=headers).status_code == 404
    assert client.get("/goals/abc", headers=headers).status_code == 422


def test_contributions_update_progress_and_complete_goal(client, headers):
    gid = make_goal(client, headers, target_amount="1000")["id"]
    r = client.post(f"/goals/{gid}/contributions", json={"amount": "400", "note": " first "}, headers=headers)
    assert r.status_code == 201 and Decimal(r.json()["current_amount"]) == 400
    assert client.get(f"/goals/{gid}/contributions", headers=headers).json()[0]["note"] == "first"
    done = client.post(f"/goals/{gid}/contributions", json={"amount": "600"}, headers=headers).json()
    assert done["status"] == "completed" and done["progress_pct"] == 100
    assert Decimal(done["suggestion_monthly_deposit"]) == 0


def test_overfunded_goal_caps_progress_at_100(client, headers):
    gid = make_goal(client, headers, target_amount="1000")["id"]
    g = client.post(f"/goals/{gid}/contributions", json={"amount": "5000"}, headers=headers).json()
    assert g["progress_pct"] == 100 and g["status"] == "completed"


@pytest.mark.parametrize(
    "body",
    [
        {"amount": "0"},
        {"amount": "abc"},
        {"amount": "1.234"},
        {"amount": "99999999999"},
        {"amount": "10", "date": (date.today() + timedelta(days=1)).isoformat()},
        {"amount": "10", "date": "1990-01-01"},
        {"amount": "10", "note": "x" * 201},
    ],
)
def test_invalid_contribution_rejected(client, headers, body):
    gid = make_goal(client, headers)["id"]
    assert client.post(f"/goals/{gid}/contributions", json=body, headers=headers).status_code == 422


def test_withdrawal_cannot_overdraw(client, headers):
    gid = make_goal(client, headers)["id"]
    client.post(f"/goals/{gid}/contributions", json={"amount": "100"}, headers=headers)
    assert client.post(f"/goals/{gid}/contributions", json={"amount": "-150"}, headers=headers).status_code == 422
    assert Decimal(client.post(f"/goals/{gid}/contributions", json={"amount": "-40"}, headers=headers).json()["current_amount"]) == 60


def test_delete_contribution(client, headers):
    gid = make_goal(client, headers)["id"]
    client.post(f"/goals/{gid}/contributions", json={"amount": "100"}, headers=headers)
    cid = client.get(f"/goals/{gid}/contributions", headers=headers).json()[0]["id"]
    g = client.delete(f"/goals/{gid}/contributions/{cid}", headers=headers).json()
    assert Decimal(g["current_amount"]) == 0
    assert client.delete(f"/goals/{gid}/contributions/{cid}", headers=headers).status_code == 404


def test_cannot_delete_other_goals_contribution_via_own_goal(client, headers):
    g1 = make_goal(client, headers)["id"]
    g2 = make_goal(client, headers, title="Other")["id"]
    client.post(f"/goals/{g2}/contributions", json={"amount": "100"}, headers=headers)
    cid = client.get(f"/goals/{g2}/contributions", headers=headers).json()[0]["id"]
    assert client.delete(f"/goals/{g1}/contributions/{cid}", headers=headers).status_code == 404


def test_summary(client, headers):
    assert client.get("/goals/summary", headers=headers).json()["goal_count"] == 0
    make_goal(client, headers, title="A", target_amount="1000")
    done = make_goal(client, headers, title="B", target_amount="500")["id"]
    client.post(f"/goals/{done}/contributions", json={"amount": "500"}, headers=headers)
    s = client.get("/goals/summary", headers=headers).json()
    assert s["goal_count"] == 2 and s["status_counts"]["completed"] == 1
    assert Decimal(s["total_target"]) == 1500 and Decimal(s["total_current"]) == 500
    assert Decimal(s["total_required_monthly"]) > 0


def test_projection_endpoint(client, headers):
    gid = make_goal(client, headers)["id"]
    client.post(f"/goals/{gid}/contributions", json={"amount": "2000"}, headers=headers)
    p = client.get(f"/goals/{gid}/projection", headers=headers).json()
    assert p["months"] > 0 and len(p["points"]) == p["months"] + 1
    assert Decimal(p["points"][0]["expected"]) == 2000
    assert Decimal(p["points"][-1]["expected"]) == pytest.approx(Decimal(120000), abs=Decimal(5))
    assert [Decimal(h["balance"]) for h in p["history"]] == [0, 2000]


def test_what_if(client, headers):
    gid = make_goal(client, headers)["id"]
    need = Decimal(client.get(f"/goals/{gid}", headers=headers).json()["suggestion_monthly_deposit"])
    enough = client.get(f"/goals/{gid}/what-if", params={"monthly": str(need + 1)}, headers=headers).json()
    short = client.get(f"/goals/{gid}/what-if", params={"monthly": str(need / 2)}, headers=headers).json()
    assert enough["reaches_target"] is True and short["reaches_target"] is False
    assert Decimal(enough["balance_at_target_date"]) >= 120000 > Decimal(short["balance_at_target_date"])
    assert client.get(f"/goals/{gid}/what-if", params={"monthly": "-1"}, headers=headers).status_code == 422
    assert client.get(f"/goals/{gid}/what-if", headers=headers).status_code == 422
