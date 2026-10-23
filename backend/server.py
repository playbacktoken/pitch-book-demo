import os
import uuid
import logging
from datetime import datetime, timezone, date, timedelta
from typing import Optional, List

from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import stripe
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field

from db import db, client
from auth import auth_router, seed_admin, get_current_user, get_current_user_optional, require_admin
from seed import seed_facilities
import emailer

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or "sk_test_emergent"
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

app = FastAPI()
api = APIRouter(prefix="/api")


# ---------- helpers ----------
def _minutes(t: str) -> int:
    h, m = map(int, t.split(":"))
    return h * 60 + m


def _end_time(start: str, duration: int) -> str:
    total = _minutes(start) + duration
    return f"{total // 60:02d}:{total % 60:02d}"


def _overlap(s1: str, e1: str, s2: str, e2: str) -> bool:
    return _minutes(s1) < _minutes(e2) and _minutes(s2) < _minutes(e1)


async def _has_conflict(facility_id: str, zones: list, date_str: str, start: str, duration: int,
                        ignore_request_id: Optional[str] = None) -> bool:
    end = _end_time(start, duration)
    zset = set(zones)
    slots = await db.slots.find({"facility_id": facility_id, "date": date_str,
                                 "status": {"$in": ["requested", "approved"]}}).to_list(1000)
    for s in slots:
        if ignore_request_id and s.get("request_id") == ignore_request_id:
            continue
        if zset & set(s.get("zones", [])) and _overlap(start, end, s["start_time"], s["end_time"]):
            return True
    blocks = await db.blocks.find({"facility_id": facility_id, "date": date_str}).to_list(1000)
    for b in blocks:
        if zset & set(b.get("zones", [])) and _overlap(start, end, b["start_time"], b["end_time"]):
            return True
    return False


def _clean(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


async def _get_facility_part(facility_id: str, part_id: str):
    fac = await db.facilities.find_one({"id": facility_id})
    if not fac:
        raise HTTPException(status_code=404, detail="Facility not found")
    part = next((p for p in fac["parts"] if p["id"] == part_id), None)
    if not part:
        raise HTTPException(status_code=404, detail="Facility part not found")
    return fac, part


# ---------- public: facilities & settings ----------
@api.get("/facilities")
async def list_facilities():
    facs = await db.facilities.find({"active": True}).sort("order", 1).to_list(100)
    return [_clean(f) for f in facs]


@api.get("/settings/public")
async def public_settings():
    s = await db.settings.find_one({"_id": "club"}) or {}
    return {"max_duration_minutes": s.get("max_duration_minutes", 270),
            "policy_note": s.get("policy_note", "")}


@api.get("/availability")
async def availability(facility_id: str, date: str):
    slots = await db.slots.find({"facility_id": facility_id, "date": date,
                                 "status": {"$in": ["requested", "approved"]}}).to_list(1000)
    blocks = await db.blocks.find({"facility_id": facility_id, "date": date}).to_list(1000)
    occupied = []
    for s in slots:
        occupied.append({"zones": s.get("zones", []), "start_time": s["start_time"],
                         "end_time": s["end_time"], "part_id": s.get("part_id"), "part_name": s.get("part_name", ""),
                         "status": s["status"], "type": "booking"})
    for b in blocks:
        occupied.append({"zones": b.get("zones", []), "start_time": b["start_time"],
                         "end_time": b["end_time"], "part_id": b.get("part_id"), "part_name": b.get("part_name", ""),
                         "status": "blocked", "type": "block", "reason": b.get("reason", "")})
    return {"occupied": occupied}


# ---------- bookings ----------
class RepeatSpec(BaseModel):
    enabled: bool = False
    weekdays: List[int] = []
    weeks: int = 1
    end_date: Optional[str] = None


class BookingCreate(BaseModel):
    facility_id: str
    part_id: str
    first_date: str
    start_time: str
    duration_minutes: int = Field(ge=60, le=600)
    repeat: RepeatSpec = RepeatSpec()
    booker_name: str
    email: EmailStr
    phone: str = ""
    notes: str = ""
    origin_url: str


def _session_dates(first_date: str, repeat: RepeatSpec, max_weeks: int = 8) -> List[str]:
    base = date.fromisoformat(first_date)
    dates = {base}
    if repeat.enabled:
        weeks = max(1, min(repeat.weeks, max_weeks))
        end = date.fromisoformat(repeat.end_date) if repeat.end_date else None
        week_monday = base - timedelta(days=base.weekday())
        wds = set(repeat.weekdays) | {base.weekday()}
        for i in range(weeks):
            for wd in wds:
                d = week_monday + timedelta(days=i * 7 + wd)
                if d < base:
                    continue
                if end and d > end:
                    continue
                dates.add(d)
    return sorted(x.isoformat() for x in dates)


@api.post("/bookings")
async def create_booking(body: BookingCreate, user=Depends(get_current_user_optional)):
    fac, part = await _get_facility_part(body.facility_id, body.part_id)
    settings = await db.settings.find_one({"_id": "club"})
    max_dur = settings.get("max_duration_minutes", 270)
    if body.duration_minutes > max_dur:
        raise HTTPException(status_code=400, detail=f"Maximum duration is {max_dur} minutes")
    fixed = fac.get("fixed_duration_minutes")
    if fixed and body.duration_minutes != fixed:
        raise HTTPException(status_code=400, detail=f"{fac['name']} can only be booked in {fixed}-minute slots")

    all_dates = _session_dates(body.first_date, body.repeat)
    booked, skipped = [], []
    for d in all_dates:
        if await _has_conflict(body.facility_id, part["zones"], d, body.start_time, body.duration_minutes):
            skipped.append(d)
        else:
            booked.append(d)

    if not booked:
        raise HTTPException(status_code=409, detail="All requested slots clash with existing bookings. Please pick another time.")

    rate = fac["hourly_rate"] * part.get("rate_multiplier", 1.0)
    per_session = round(rate * (body.duration_minutes / 60.0), 2)
    is_paid = fac["is_paid"] and per_session > 0
    total = round(per_session * len(booked), 2)

    rid = str(uuid.uuid4())
    count = await db.requests.count_documents({})
    reference = f"WGFC-{2000 + count}"
    now = datetime.now(timezone.utc).isoformat()

    req_doc = {
        "id": rid, "reference": reference, "user_id": (user["id"] if user else None),
        "booker_name": body.booker_name, "email": body.email.lower(), "phone": body.phone, "notes": body.notes,
        "facility_id": fac["id"], "facility_name": fac["name"],
        "part_id": part["id"], "part_name": part["name"],
        "status": "requested", "is_paid": is_paid, "amount": total, "currency": "eur",
        "payment_status": ("pending" if is_paid else "none"), "session_id": None,
        "session_count": len(booked), "per_session_amount": per_session, "admin_note": "",
        "created_at": now, "first_date": booked[0], "start_time": body.start_time,
        "duration_minutes": body.duration_minutes, "skipped_dates": skipped,
    }
    await db.requests.insert_one(dict(req_doc))

    end = _end_time(body.start_time, body.duration_minutes)
    for d in booked:
        await db.slots.insert_one({
            "id": str(uuid.uuid4()), "request_id": rid, "reference": reference,
            "facility_id": fac["id"], "part_id": part["id"], "zones": part["zones"],
            "date": d, "start_time": body.start_time, "duration_minutes": body.duration_minutes,
            "end_time": end, "status": "requested",
        })

    checkout_url = None
    if is_paid:
        session = stripe.checkout.Session.create(
            line_items=[{"price_data": {"currency": "eur",
                                        "unit_amount": int(round(total * 100)),
                                        "product_data": {"name": f'{fac["name"]} — {part["name"]}',
                                                         "description": f'{len(booked)} session(s) · {reference}'}},
                         "quantity": 1}],
            mode="payment",
            success_url=f"{body.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{body.origin_url}/payment/cancel?ref={reference}",
            metadata={"request_id": rid, "reference": reference},
        )
        await db.requests.update_one({"id": rid}, {"$set": {"session_id": session.id}})
        await db.payment_transactions.insert_one({
            "session_id": session.id, "request_id": rid, "reference": reference,
            "amount": total, "currency": "eur", "status": "initiated", "payment_status": "pending",
            "created_at": now, "updated_at": now,
        })
        checkout_url = session.url

    await emailer.send_booking_confirmation(req_doc)
    admin_email = settings.get("alert_email") or os.environ.get("ADMIN_EMAIL")
    if admin_email:
        await emailer.send_admin_alert(req_doc, admin_email)

    return {"request": _clean(req_doc), "booked_dates": booked, "skipped_dates": skipped,
            "checkout_url": checkout_url}


@api.get("/bookings/lookup")
async def lookup_bookings(reference: Optional[str] = None, email: Optional[str] = None):
    q = {}
    if reference:
        q["reference"] = reference.strip().upper()
    elif email:
        q["email"] = email.strip().lower()
    else:
        raise HTTPException(status_code=400, detail="Provide a reference or email")
    reqs = await db.requests.find(q).sort("created_at", -1).to_list(100)
    return [_clean(r) for r in reqs]


@api.get("/my-bookings")
async def my_bookings(user=Depends(get_current_user)):
    reqs = await db.requests.find({"user_id": user["id"]}).sort("created_at", -1).to_list(200)
    return [_clean(r) for r in reqs]


# ---------- payments ----------
@api.get("/payments/status/{session_id}")
async def payment_status(session_id: str):
    record = await db.payment_transactions.find_one({"session_id": session_id})
    if not record:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if record.get("payment_status") != "paid":
        try:
            s = stripe.checkout.Session.retrieve(session_id)
            if s.payment_status == "paid" or s.status == "complete":
                await _mark_paid(session_id)
                record = await db.payment_transactions.find_one({"session_id": session_id})
        except stripe.error.StripeError:
            pass
    return {"session_id": record["session_id"], "status": record["status"],
            "payment_status": record["payment_status"], "reference": record.get("reference")}


async def _mark_paid(session_id: str):
    now = datetime.now(timezone.utc).isoformat()
    res = await db.payment_transactions.update_one(
        {"session_id": session_id, "payment_status": {"$ne": "paid"}},
        {"$set": {"status": "completed", "payment_status": "paid", "updated_at": now}})
    if res.modified_count:
        await db.requests.update_one({"session_id": session_id}, {"$set": {"payment_status": "paid"}})


@api.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except (stripe.error.SignatureVerificationError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid signature")
    obj, t = event["data"]["object"], event["type"]
    if t == "checkout.session.completed":
        await _mark_paid(obj["id"])
    elif t == "checkout.session.expired":
        await db.payment_transactions.update_one({"session_id": obj["id"]},
            {"$set": {"status": "expired", "payment_status": "expired"}})
    return {"status": "ok"}


# ---------- admin ----------
class DecisionBody(BaseModel):
    note: str = ""


async def _set_request_status(request_id: str, status: str, note: str):
    req = await db.requests.find_one({"id": request_id})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    await db.requests.update_one({"id": request_id}, {"$set": {"status": status, "admin_note": note}})
    await db.slots.update_many({"request_id": request_id}, {"$set": {"status": status}})
    req["status"], req["admin_note"] = status, note
    await emailer.send_status_update(req)
    return _clean(req)


@api.get("/admin/requests")
async def admin_requests(status: Optional[str] = None, _=Depends(require_admin)):
    q = {} if not status or status == "all" else {"status": status}
    reqs = await db.requests.find(q).sort("created_at", -1).to_list(500)
    out = []
    for r in reqs:
        slots = await db.slots.find({"request_id": r["id"]}).sort("date", 1).to_list(100)
        r = _clean(r)
        r["slots"] = [_clean(s) for s in slots]
        out.append(r)
    return out


@api.post("/admin/requests/{request_id}/approve")
async def approve_request(request_id: str, body: DecisionBody, _=Depends(require_admin)):
    return await _set_request_status(request_id, "approved", body.note)


@api.post("/admin/requests/{request_id}/decline")
async def decline_request(request_id: str, body: DecisionBody, _=Depends(require_admin)):
    return await _set_request_status(request_id, "declined", body.note)


class FacilityBody(BaseModel):
    id: Optional[str] = None
    name: str
    tag: str = ""
    photo: str = ""
    note: str = ""
    is_paid: bool = False
    hourly_rate: float = 0.0
    fixed_duration_minutes: Optional[int] = None
    area_hint: str = ""
    active: bool = True
    order: int = 99
    parts: List[dict] = []


@api.post("/admin/facilities")
async def create_facility(body: FacilityBody, _=Depends(require_admin)):
    doc = body.model_dump()
    doc["id"] = doc.get("id") or str(uuid.uuid4())[:8]
    if await db.facilities.find_one({"id": doc["id"]}):
        raise HTTPException(status_code=400, detail="Facility id already exists")
    for p in doc["parts"]:
        p.setdefault("id", str(uuid.uuid4())[:8])
        p.setdefault("rate_multiplier", 1.0)
        p.setdefault("zones", [p["id"]])
    await db.facilities.insert_one(dict(doc))
    return _clean(doc)


@api.put("/admin/facilities/{facility_id}")
async def update_facility(facility_id: str, body: FacilityBody, _=Depends(require_admin)):
    doc = body.model_dump()
    doc.pop("id", None)
    for p in doc["parts"]:
        p.setdefault("id", str(uuid.uuid4())[:8])
        p.setdefault("rate_multiplier", 1.0)
        p.setdefault("zones", [p["id"]])
    res = await db.facilities.update_one({"id": facility_id}, {"$set": doc})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Facility not found")
    updated = await db.facilities.find_one({"id": facility_id})
    return _clean(updated)


@api.delete("/admin/facilities/{facility_id}")
async def delete_facility(facility_id: str, _=Depends(require_admin)):
    await db.facilities.delete_one({"id": facility_id})
    return {"status": "ok"}


class BlockBody(BaseModel):
    facility_id: str
    part_id: str
    date: str
    start_time: str
    duration_minutes: int = Field(ge=15, le=1440)
    reason: str = ""


@api.get("/admin/blocks")
async def list_blocks(_=Depends(require_admin)):
    blocks = await db.blocks.find({}).sort("date", 1).to_list(500)
    return [_clean(b) for b in blocks]


@api.post("/admin/blocks")
async def create_block(body: BlockBody, _=Depends(require_admin)):
    fac, part = await _get_facility_part(body.facility_id, body.part_id)
    doc = {"id": str(uuid.uuid4()), "facility_id": fac["id"], "facility_name": fac["name"],
           "part_id": part["id"], "part_name": part["name"], "zones": part["zones"],
           "date": body.date, "start_time": body.start_time, "duration_minutes": body.duration_minutes,
           "end_time": _end_time(body.start_time, body.duration_minutes), "reason": body.reason}
    await db.blocks.insert_one(dict(doc))
    return _clean(doc)


@api.delete("/admin/blocks/{block_id}")
async def delete_block(block_id: str, _=Depends(require_admin)):
    await db.blocks.delete_one({"id": block_id})
    return {"status": "ok"}


class SettingsBody(BaseModel):
    alert_email: EmailStr
    max_duration_minutes: int = Field(ge=60, le=600)
    policy_note: str = ""


@api.get("/admin/settings")
async def get_settings(_=Depends(require_admin)):
    s = await db.settings.find_one({"_id": "club"})
    s.pop("_id", None)
    return s


@api.put("/admin/settings")
async def update_settings(body: SettingsBody, _=Depends(require_admin)):
    await db.settings.update_one({"_id": "club"}, {"$set": body.model_dump()})
    s = await db.settings.find_one({"_id": "club"})
    s.pop("_id", None)
    return s


app.include_router(auth_router)
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000"),
                   "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await seed_admin()
    await seed_facilities()
    logger.info("Startup seeding complete")


@app.on_event("shutdown")
async def shutdown():
    client.close()
