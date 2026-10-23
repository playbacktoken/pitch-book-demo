import asyncio, sys
from datetime import date, timedelta
sys.path.insert(0,"/app/backend")
from dotenv import load_dotenv; load_dotenv("/app/backend/.env")
from db import db
async def m(rid, mode):
    slots=await db.slots.find({"request_id":rid}).sort("date",1).to_list(10)
    if mode=="setup":
        await db.slots.update_one({"id":slots[0]["id"]},{"$set":{"pay_due_at":"2020-01-01T00:00:00+00:00"}})
        await db.slots.update_one({"id":slots[1]["id"]},{"$set":{"date":(date.today()+timedelta(days=1)).isoformat()}})
    for s in await db.slots.find({"request_id":rid}).sort("date",1).to_list(10):
        print(s["date"], s["status"], s.get("pay_status"), s.get("pay_due_at"))
    r=await db.requests.find_one({"id":rid}); print("request", r["status"], r["payment_status"])
asyncio.run(m(sys.argv[1], sys.argv[2]))
