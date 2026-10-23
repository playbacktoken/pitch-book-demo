import asyncio, sys
sys.path.insert(0,"/app/backend")
from dotenv import load_dotenv; load_dotenv("/app/backend/.env")
from db import db
import payflow
async def m(rid):
    tx=await db.payment_transactions.find_one({"request_id":rid},sort=[("created_at",-1)])
    print("tx slots", len(tx["slot_ids"]), tx["amount"])
    await payflow.mark_paid(tx["session_id"])
asyncio.run(m(sys.argv[1]))
