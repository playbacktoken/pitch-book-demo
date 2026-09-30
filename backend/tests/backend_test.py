"""Walterstown GFC — end-to-end backend API tests (pytest)."""
import os
import uuid
from datetime import date, timedelta

import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://chat-first-dev-1.preview.emergentagent.com"
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@walterstowngfc.ie"
ADMIN_PASSWORD = "Walterstown1902"


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def s():
    return requests.Session()


@pytest.fixture(scope="session")
def admin_session():
    sess = requests.Session()
    r = sess.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    assert sess.cookies.get("access_token"), "no access_token cookie set"
    return sess


def _future(days=7):
    return (date.today() + timedelta(days=days)).isoformat()


# ---------- public facilities/settings ----------
class TestPublic:
    def test_facilities_list(self, s):
        r = s.get(f"{API}/facilities")
        assert r.status_code == 200
        facs = r.json()
        ids = {f["id"] for f in facs}
        assert {"astro", "main_pitch", "back_pitch", "training_pitch", "juvenile_pitch", "gym"} <= ids
        for f in facs:
            assert "_id" not in f
            assert "parts" in f and len(f["parts"]) >= 1

    def test_public_settings(self, s):
        r = s.get(f"{API}/settings/public")
        assert r.status_code == 200
        data = r.json()
        assert "max_duration_minutes" in data
        assert data["max_duration_minutes"] >= 60

    def test_availability(self, s):
        r = s.get(f"{API}/availability", params={"facility_id": "astro", "date": _future(1)})
        assert r.status_code == 200
        assert "occupied" in r.json()


# ---------- guest bookings ----------
class TestBookingsGuest:
    def test_free_booking_juvenile(self, s):
        payload = {
            "facility_id": "juvenile_pitch", "part_id": "juvenile_full",
            "first_date": _future(10), "start_time": "11:00", "duration_minutes": 60,
            "booker_name": "TEST_Guest Free", "email": f"test_free_{uuid.uuid4().hex[:6]}@example.com",
            "phone": "0871234567", "notes": "guest free test", "origin_url": BASE_URL,
        }
        r = s.post(f"{API}/bookings", json=payload)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["checkout_url"] is None
        req = j["request"]
        assert req["payment_status"] == "none"
        assert req["status"] == "requested"
        assert req["reference"].startswith("WGFC-")

    def test_paid_booking_gym_returns_checkout(self, s):
        payload = {
            "facility_id": "gym", "part_id": "gym_full",
            "first_date": _future(12), "start_time": "07:00", "duration_minutes": 60,
            "booker_name": "TEST_Guest Paid", "email": f"test_paid_{uuid.uuid4().hex[:6]}@example.com",
            "phone": "0871234567", "notes": "paid test", "origin_url": BASE_URL,
        }
        r = s.post(f"{API}/bookings", json=payload)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["checkout_url"] and j["checkout_url"].startswith("https://checkout.stripe.com"), j
        req = j["request"]
        assert req["is_paid"] is True
        assert req["amount"] == 35.0
        assert req["payment_status"] == "pending"

    def test_repeat_booking_creates_sessions(self, s):
        first = date.today() + timedelta(days=14)
        payload = {
            "facility_id": "back_pitch", "part_id": "back_full",
            "first_date": first.isoformat(), "start_time": "09:00", "duration_minutes": 60,
            "repeat": {"enabled": True, "weekdays": [first.weekday()], "weeks": 3},
            "booker_name": "TEST_Repeat", "email": f"test_rep_{uuid.uuid4().hex[:6]}@example.com",
            "phone": "0870000000", "origin_url": BASE_URL,
        }
        r = s.post(f"{API}/bookings", json=payload)
        assert r.status_code == 200, r.text
        j = r.json()
        assert len(j["booked_dates"]) >= 2
        assert j["request"]["session_count"] == len(j["booked_dates"])

    def test_conflict_full_vs_part(self, s):
        d = _future(20)
        # Book astro_full
        p1 = {
            "facility_id": "astro", "part_id": "astro_full",
            "first_date": d, "start_time": "17:00", "duration_minutes": 60,
            "booker_name": "TEST_Full", "email": f"test_full_{uuid.uuid4().hex[:6]}@example.com",
            "phone": "0870000000", "origin_url": BASE_URL,
        }
        r1 = s.post(f"{API}/bookings", json=p1)
        assert r1.status_code == 200, r1.text
        # Cage 2 overlapping should conflict
        p2 = dict(p1)
        p2["part_id"] = "astro_cage_2"
        p2["email"] = f"test_c2_{uuid.uuid4().hex[:6]}@example.com"
        r2 = s.post(f"{API}/bookings", json=p2)
        assert r2.status_code == 409, r2.text
        # Non-overlapping time on cage 2 should succeed
        p3 = dict(p2)
        p3["start_time"] = "19:00"
        p3["email"] = f"test_c2b_{uuid.uuid4().hex[:6]}@example.com"
        r3 = s.post(f"{API}/bookings", json=p3)
        assert r3.status_code == 200, r3.text

    def test_max_duration_enforced(self, s):
        payload = {
            "facility_id": "juvenile_pitch", "part_id": "juvenile_full",
            "first_date": _future(30), "start_time": "10:00", "duration_minutes": 400,
            "booker_name": "TEST_MaxDur", "email": f"test_max_{uuid.uuid4().hex[:6]}@example.com",
            "phone": "0870000000", "origin_url": BASE_URL,
        }
        r = s.post(f"{API}/bookings", json=payload)
        # Pydantic ge=60 le=600 allows 400; server checks against club max (270) → 400
        assert r.status_code == 400, r.text


# ---------- lookup ----------
class TestLookup:
    def test_lookup_by_reference(self, s):
        r = s.get(f"{API}/bookings/lookup", params={"reference": "WGFC-1000"})
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        assert data[0]["reference"] == "WGFC-1000"

    def test_lookup_by_email(self, s):
        r = s.get(f"{API}/bookings/lookup", params={"email": "senior@walterstowngfc.ie"})
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_lookup_missing_params(self, s):
        r = s.get(f"{API}/bookings/lookup")
        assert r.status_code == 400


# ---------- auth ----------
class TestAuth:
    def test_register_and_me(self):
        sess = requests.Session()
        email = f"test_user_{uuid.uuid4().hex[:8]}@example.com"
        r = sess.post(f"{API}/auth/register", json={
            "name": "TEST_User", "email": email, "password": "Passw0rd!", "phone": "0870000000"
        })
        assert r.status_code == 200, r.text
        assert sess.cookies.get("access_token")
        m = sess.get(f"{API}/auth/me")
        assert m.status_code == 200
        assert m.json()["email"] == email
        mb = sess.get(f"{API}/my-bookings")
        assert mb.status_code == 200
        assert isinstance(mb.json(), list)

    def test_login_bad_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong-pw"})
        assert r.status_code == 401

    def test_admin_login_sets_cookie(self, admin_session):
        r = admin_session.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json().get("role") == "admin"


# ---------- admin ----------
class TestAdmin:
    def test_requires_auth(self):
        r = requests.get(f"{API}/admin/requests")
        assert r.status_code == 401

    def test_list_requests(self, admin_session):
        r = admin_session.get(f"{API}/admin/requests")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_filter_requested(self, admin_session):
        r = admin_session.get(f"{API}/admin/requests", params={"status": "requested"})
        assert r.status_code == 200
        for req in r.json():
            assert req["status"] == "requested"

    def test_approve_and_decline_flow(self, admin_session):
        # create a fresh booking to approve
        payload = {
            "facility_id": "juvenile_pitch", "part_id": "juvenile_full",
            "first_date": _future(40), "start_time": "12:00", "duration_minutes": 60,
            "booker_name": "TEST_Approve", "email": f"test_ap_{uuid.uuid4().hex[:6]}@example.com",
            "phone": "0870000000", "origin_url": BASE_URL,
        }
        r = requests.post(f"{API}/bookings", json=payload)
        rid = r.json()["request"]["id"]
        a = admin_session.post(f"{API}/admin/requests/{rid}/approve", json={"note": "OK"})
        assert a.status_code == 200
        assert a.json()["status"] == "approved"

        # create another and decline
        payload["first_date"] = _future(41)
        payload["email"] = f"test_dec_{uuid.uuid4().hex[:6]}@example.com"
        r2 = requests.post(f"{API}/bookings", json=payload)
        rid2 = r2.json()["request"]["id"]
        d = admin_session.post(f"{API}/admin/requests/{rid2}/decline", json={"note": "Conflict"})
        assert d.status_code == 200
        assert d.json()["status"] == "declined"

    def test_facility_crud(self, admin_session):
        fid = f"test_{uuid.uuid4().hex[:6]}"
        body = {"id": fid, "name": "TEST_Facility", "tag": "test", "photo": "",
                "note": "n", "is_paid": True, "hourly_rate": 10.0, "active": True, "order": 99,
                "parts": [{"id": "p1", "name": "Full", "rate_multiplier": 1.0, "zones": ["z1"]}]}
        c = admin_session.post(f"{API}/admin/facilities", json=body)
        assert c.status_code == 200, c.text
        u = admin_session.put(f"{API}/admin/facilities/{fid}", json={**body, "note": "updated"})
        assert u.status_code == 200
        assert u.json()["note"] == "updated"
        d = admin_session.delete(f"{API}/admin/facilities/{fid}")
        assert d.status_code == 200

    def test_block_crud_and_availability(self, admin_session, s):
        d = _future(50)
        body = {"facility_id": "gym", "part_id": "gym_full", "date": d,
                "start_time": "08:00", "duration_minutes": 60, "reason": "TEST_maintenance"}
        c = admin_session.post(f"{API}/admin/blocks", json=body)
        assert c.status_code == 200
        block_id = c.json()["id"]
        # availability should include it
        av = s.get(f"{API}/availability", params={"facility_id": "gym", "date": d})
        assert any(x.get("type") == "block" for x in av.json()["occupied"])
        # list
        ls = admin_session.get(f"{API}/admin/blocks")
        assert any(b["id"] == block_id for b in ls.json())
        # delete
        rm = admin_session.delete(f"{API}/admin/blocks/{block_id}")
        assert rm.status_code == 200

    def test_settings_update(self, admin_session):
        cur = admin_session.get(f"{API}/admin/settings").json()
        body = {"alert_email": cur.get("alert_email") or ADMIN_EMAIL,
                "max_duration_minutes": 270,
                "policy_note": cur.get("policy_note", "") or "policy"}
        r = admin_session.put(f"{API}/admin/settings", json=body)
        assert r.status_code == 200
        assert r.json()["max_duration_minutes"] == 270
