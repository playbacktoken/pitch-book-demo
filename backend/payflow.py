import os
import hmac
import secrets
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from typing import Literal

import stripe
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from db import db
import emailer

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")

PAY_WINDOW = timedelta(hours=6)
TZ = ZoneInfo("Europe/Dublin")


def _now():
    return datetime.now(timezone.utc)


def fmt_due(iso: str) -> str:
    return datetime.fromisoformat(iso).astimezone(TZ).strftime("%a %d %b, %H:%M")


def pay_link(req: dict) -> str:
    return f'{req["origin_url"]}/pay/{req["id"]}?t={req["pay_token"]}'


async def _unpaid(rid: str):
    return await db.slots.find({"request_id": rid, "status": "approved", "pay_status": "unpaid"}).sort(
        [("date", 1), ("start_time", 1)]).to_list(500)


async def refresh_payment_status(rid: str):
    approved = await db.slots.count_documents({"request_id": rid, "status": "approved"})
    unpaid = await db.slots.count_documents({"request_id": rid, "status": "approved", "pay_status": "unpaid"})
    paid = await db.slots.count_documents({"request_id": rid, "pay_status": "paid"})
    if approved and not unpaid:
        status = "paid"
    elif paid:
        status = "partial"
    elif approved:
        status = "due"
    else:
        status = "expired"
    await db.requests.update_one({"id": rid}, {"$set": {"payment_status": status}})
    return status


def _pay_info(req: dict, unpaid: list, due_iso: str) -> dict:
    per = req.get("per_session_amount", 0)
    return {"url": pay_link(req), "due": fmt_due(due_iso), "next_amount": per,
            "all_amount": round(per * len(unpaid), 2), "count": len(unpaid)}


async def on_approved(req: dict):
    """Open a 6-hour payment window for the first session and return email payment info."""
    token = req.get("pay_token") or secrets.token_urlsafe(24)
    await db.requests.update_one({"id": req["id"]}, {"$set": {"pay_token": token, "payment_status": "due"}})
    req["pay_token"], req["payment_status"] = token, "due"
    unpaid = await _unpaid(req["id"])
    if not unpaid:
        return None
    due = (_now() + PAY_WINDOW).isoformat()
    await db.slots.update_one({"id": unpaid[0]["id"]}, {"$set": {"pay_due_at": due}})
    return _pay_info(req, unpaid, due)


async def mark_paid(session_id: str):
    now = _now().isoformat()
    res = await db.payment_transactions.update_one(
        {"session_id": session_id, "payment_status": {"$ne": "paid"}},
        {"$set": {"status": "completed", "payment_status": "paid", "updated_at": now}})
    if not res.modified_count:
        return
    tx = await db.payment_transactions.find_one({"session_id": session_id})
    await db.slots.update_many({"id": {"$in": tx.get("slot_ids", [])}},
                               {"$set": {"pay_status": "paid", "pay_due_at": None}})
    await refresh_payment_status(tx["request_id"])


# ---------- public pay page ----------
async def _load(rid: str, t: str) -> dict:
    req = await db.requests.find_one({"id": rid})
    if not req or not req.get("pay_token") or not hmac.compare_digest(req["pay_token"], t or ""):
        raise HTTPException(status_code=404, detail="Payment link not found")
    return req


@router.get("/pay/{rid}")
async def pay_details(rid: str, t: str):
    req = await _load(rid, t)
    unpaid = await _unpaid(rid)
    paid = await db.slots.count_documents({"request_id": rid, "pay_status": "paid"})
    return {
        "reference": req["reference"], "booker_name": req["booker_name"],
        "facility_name": req["facility_name"], "part_name": req["part_name"],
        "status": req["status"], "payment_status": req.get("payment_status"),
        "per_session_amount": req.get("per_session_amount", 0), "paid_count": paid,
        "unpaid": [{"id": s["id"], "date": s["date"], "start_time": s["start_time"], "end_time": s["end_time"],
                    "pay_due_at": s.get("pay_due_at")} for s in unpaid],
    }


class CheckoutBody(BaseModel):
    t: str
    mode: Literal["next", "all"]
    origin_url: str


@router.post("/pay/{rid}/checkout")
async def pay_checkout(rid: str, body: CheckoutBody):
    req = await _load(rid, body.t)
    unpaid = await _unpaid(rid)
    if not unpaid:
        raise HTTPException(status_code=400, detail="There is nothing left to pay on this booking.")
    chosen = unpaid if body.mode == "all" else unpaid[:1]
    amount = round(req.get("per_session_amount", 0) * len(chosen), 2)
    session = stripe.checkout.Session.create(
        line_items=[{"price_data": {"currency": "eur", "unit_amount": int(round(amount * 100)),
                                    "product_data": {"name": f'{req["facility_name"]} — {req["part_name"]}',
                                                     "description": f'{len(chosen)} session(s) · {req["reference"]}'}},
                     "quantity": 1}],
        mode="payment",
        success_url=f"{body.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f'{body.origin_url}/pay/{rid}?t={body.t}',
        metadata={"request_id": rid, "reference": req["reference"]},
    )
    now = _now().isoformat()
    await db.payment_transactions.insert_one({
        "session_id": session.id, "request_id": rid, "reference": req["reference"],
        "slot_ids": [s["id"] for s in chosen], "amount": amount, "currency": "eur",
        "status": "initiated", "payment_status": "pending", "created_at": now, "updated_at": now,
    })
    return {"checkout_url": session.url}


# ---------- scheduled job ----------
async def run_payment_jobs():
    now = _now()
    # 1) remove sessions whose 6-hour payment window has passed
    expired = await db.slots.find({"status": "approved", "pay_status": "unpaid",
                                   "pay_due_at": {"$ne": None, "$lte": now.isoformat()}}).to_list(1000)
    by_req = {}
    for s in expired:
        by_req.setdefault(s["request_id"], []).append(s)
    for rid, slots in by_req.items():
        await db.slots.update_many({"id": {"$in": [s["id"] for s in slots]}}, {"$set": {"status": "cancelled"}})
        if not await db.slots.count_documents({"request_id": rid, "status": "approved"}):
            await db.requests.update_one({"id": rid}, {"$set": {"status": "cancelled"}})
        await refresh_payment_status(rid)
        req = await db.requests.find_one({"id": rid})
        await emailer.send_payment_expired(req, sorted(s["date"] for s in slots))

    # 2) open a payment window the day before each unpaid weekly session
    tomorrow = (datetime.now(TZ).date() + timedelta(days=1)).isoformat()
    upcoming = await db.slots.find({"status": "approved", "pay_status": "unpaid", "pay_due_at": None,
                                    "date": {"$lte": tomorrow}}).to_list(1000)
    by_req = {}
    for s in upcoming:
        by_req.setdefault(s["request_id"], []).append(s)
    due = (now + PAY_WINDOW).isoformat()
    for rid, slots in by_req.items():
        await db.slots.update_many({"id": {"$in": [s["id"] for s in slots]}}, {"$set": {"pay_due_at": due}})
        req = await db.requests.find_one({"id": rid})
        unpaid = await _unpaid(rid)
        await emailer.send_payment_due(req, sorted(s["date"] for s in slots), _pay_info(req, unpaid, due))
    logger.info(f"Payment jobs: {len(expired)} expired, {len(upcoming)} newly due")


@router.post("/cron/payments")
async def cron_payments(request: Request):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    auth = request.headers.get("authorization", "")
    secret = os.environ["WEBHOOK_CRON_SECRET"]
    if not auth.startswith("Bearer ") or not hmac.compare_digest(auth[7:], secret):
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        body = await request.json()
    except Exception:
        body = {}
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Invalid body")
    run_id = request.headers.get("x-webhook-id") or body.get("run_id")
    if run_id:
        if await db.cron_runs.find_one({"_id": run_id}):
            return {"status": "duplicate"}
        await db.cron_runs.insert_one({"_id": run_id, "at": _now().isoformat()})
    asyncio.create_task(run_payment_jobs())
    return {"status": "accepted"}
