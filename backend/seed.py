from datetime import datetime, timezone, timedelta
from db import db

# Each facility carries parts; each part occupies a set of "zones".
# Booking a part blocks any other part that shares a zone (full <-> parts linkage).
FACILITIES = [
    {
        "id": "astro", "name": "Astro", "tag": "Astro",
        "photo": "https://images.unsplash.com/photo-1600529533273-938db2591dc4?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
        "note": "Book the full astro or a single cage.",
        "is_paid": True, "hourly_rate": 160.0, "fixed_duration_minutes": 60, "active": True, "order": 1,
        "parts": [
            {"id": "astro_full", "name": "Full Astro", "rate_multiplier": 1.0, "zones": ["c1", "c2", "c3"]},
            {"id": "astro_cage_1", "name": "Cage 1 (North End)", "rate_multiplier": 0.325, "zones": ["c1"]},
            {"id": "astro_cage_2", "name": "Cage 2 (Middle)", "rate_multiplier": 0.325, "zones": ["c2"]},
            {"id": "astro_cage_3", "name": "Cage 3 (South End)", "rate_multiplier": 0.325, "zones": ["c3"]},
        ],
    },
    {
        "id": "main_pitch", "name": "Main Pitch", "tag": "Grass pitch",
        "photo": "https://images.unsplash.com/photo-1531410828623-a21e67dae762?crop=entropy&cs=srgb&fm=jpg&q=85",
        "note": "Book the full pitch or one half.",
        "is_paid": False, "hourly_rate": 0.0, "active": True, "order": 2,
        "parts": [
            {"id": "main_full", "name": "Full Pitch", "rate_multiplier": 1.0, "zones": ["top", "bottom"]},
            {"id": "main_top_half", "name": "Top Half (Clubhouse End)", "rate_multiplier": 0.55, "zones": ["top"]},
            {"id": "main_second_half", "name": "Bottom Half (Far End)", "rate_multiplier": 0.55, "zones": ["bottom"]},
        ],
    },
    {
        "id": "back_pitch", "name": "Back Pitch", "tag": "Grass pitch",
        "photo": "https://images.unsplash.com/photo-1783787748654-eabdf2ebf80d?crop=entropy&cs=srgb&fm=jpg&q=85",
        "note": "Book the full pitch or one half. Left and right are as you look out at the pitch with the clubhouse behind you.",
        "is_paid": False, "hourly_rate": 0.0, "active": True, "order": 3,
        "parts": [
            {"id": "back_full", "name": "Full Pitch", "rate_multiplier": 1.0, "zones": ["staf", "bol"]},
            {"id": "back_stafford", "name": "Left Half", "rate_multiplier": 0.5, "zones": ["staf"]},
            {"id": "back_boland", "name": "Right Half", "rate_multiplier": 0.5, "zones": ["bol"]},
        ],
    },
    {
        "id": "training_pitch", "name": "Training Pitch", "tag": "Training",
        "photo": "https://images.unsplash.com/photo-1729843352938-0e10fbf96585?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
        "note": "Book the full training pitch or one area.",
        "is_paid": False, "hourly_rate": 0.0, "active": True, "order": 4,
        "parts": [
            {"id": "train_full", "name": "Full Training Ground", "rate_multiplier": 1.0, "zones": ["a1", "a2"]},
            {"id": "train_area_1", "name": "Area 1", "rate_multiplier": 0.5, "zones": ["a1"]},
            {"id": "train_area_2", "name": "Area 2", "rate_multiplier": 0.5, "zones": ["a2"]},
        ],
    },
    {
        "id": "juvenile_pitch", "name": "Juvenile Pitch", "tag": "Underage",
        "photo": "https://images.unsplash.com/photo-1526232761682-d26e03ac148e?crop=entropy&cs=srgb&fm=jpg&q=85",
        "note": "For underage training and games.",
        "is_paid": False, "hourly_rate": 0.0, "active": True, "order": 5,
        "parts": [
            {"id": "juvenile_full", "name": "Full Juvenile Pitch", "rate_multiplier": 1.0, "zones": ["main"]},
        ],
    },
    {
        "id": "gym", "name": "Gym", "tag": "Indoor",
        "photo": "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
        "note": "Book the whole gym for a team, or an individual slot.",
        "is_paid": False, "hourly_rate": 0.0, "active": True, "order": 6,
        "parts": [
            {"id": "gym_full", "name": "Full Gym", "rate_multiplier": 1.0, "zones": ["gym"]},
            {"id": "gym_slot", "name": "Individual Slot", "rate_multiplier": 0.25, "zones": ["gym"]},
        ],
    },
]


async def seed_facilities():
    for f in FACILITIES:
        existing = await db.facilities.find_one({"id": f["id"]})
        if existing is None:
            await db.facilities.insert_one(dict(f))
    await db.facilities.create_index("id", unique=True)
    await db.requests.create_index("reference")
    await db.slots.create_index([("facility_id", 1), ("date", 1)])
    await db.blocks.create_index([("facility_id", 1), ("date", 1)])

    settings = await db.settings.find_one({"_id": "club"})
    if settings is None:
        import os
        await db.settings.insert_one({
            "_id": "club",
            "alert_email": os.environ.get("ADMIN_EMAIL", "admin@walterstowngfc.ie"),
            "max_duration_minutes": 270,
            "policy_note": "All bookings must be approved by the club.",
        })

    if await db.requests.count_documents({}) == 0:
        await _seed_sample_bookings()


def _end_time(start: str, minutes: int) -> str:
    h, m = map(int, start.split(":"))
    total = h * 60 + m + minutes
    return f"{total // 60:02d}:{total % 60:02d}"


async def _seed_sample_bookings():
    import uuid
    today = datetime.now(timezone.utc).date()

    def d(offset):
        return (today + timedelta(days=offset)).isoformat()

    samples = [
        {"facility_id": "main_pitch", "part_id": "main_full", "part_name": "Full Pitch",
         "facility_name": "Main Pitch", "zones": ["top", "bottom"], "date": d(2),
         "start_time": "19:00", "duration": 90, "booker_name": "Walterstown Senior Men",
         "email": "senior@walterstowngfc.ie", "phone": "0871234567", "status": "approved",
         "is_paid": False, "amount": 0.0, "payment_status": "none"},
        {"facility_id": "astro", "part_id": "astro_cage_2", "part_name": "Cage 2 (Middle)",
         "facility_name": "Astro", "zones": ["c2"], "date": d(1),
         "start_time": "18:00", "duration": 60, "booker_name": "Under-15 Camogie",
         "email": "camogie@walterstowngfc.ie", "phone": "0867654321", "status": "requested",
         "is_paid": True, "amount": 21.0, "payment_status": "paid"},
        {"facility_id": "juvenile_pitch", "part_id": "juvenile_full", "part_name": "Full Juvenile Pitch",
         "facility_name": "Juvenile Pitch", "zones": ["main"], "date": d(3),
         "start_time": "10:00", "duration": 120, "booker_name": "Nursery Saturday Morning",
         "email": "nursery@walterstowngfc.ie", "phone": "0851112223", "status": "approved",
         "is_paid": False, "amount": 0.0, "payment_status": "none"},
        {"facility_id": "back_pitch", "part_id": "back_stafford", "part_name": "Left Half",
         "facility_name": "Back Pitch", "zones": ["staf"], "date": d(1),
         "start_time": "20:00", "duration": 75, "booker_name": "Local 5-a-side",
         "email": "fiveaside@example.com", "phone": "0834445556", "status": "requested",
         "is_paid": False, "amount": 0.0, "payment_status": "none"},
    ]

    for i, s in enumerate(samples):
        rid = str(uuid.uuid4())
        ref = f"WGFC-{1000 + i}"
        end = _end_time(s["start_time"], s["duration"])
        req = {
            "id": rid, "reference": ref, "user_id": None,
            "booker_name": s["booker_name"], "email": s["email"], "phone": s["phone"], "notes": "",
            "facility_id": s["facility_id"], "facility_name": s["facility_name"],
            "part_id": s["part_id"], "part_name": s["part_name"],
            "status": s["status"], "is_paid": s["is_paid"], "amount": s["amount"],
            "currency": "eur", "payment_status": s["payment_status"], "session_id": None,
            "session_count": 1, "admin_note": "",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "first_date": s["date"], "start_time": s["start_time"], "duration_minutes": s["duration"],
        }
        await db.requests.insert_one(req)
        await db.slots.insert_one({
            "id": str(uuid.uuid4()), "request_id": rid, "reference": ref,
            "facility_id": s["facility_id"], "part_id": s["part_id"], "zones": s["zones"],
            "date": s["date"], "start_time": s["start_time"], "duration_minutes": s["duration"],
            "end_time": end, "status": s["status"],
        })
