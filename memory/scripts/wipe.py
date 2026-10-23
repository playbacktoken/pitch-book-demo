import asyncio, sys
sys.path.insert(0,"/app/backend")
from dotenv import load_dotenv; load_dotenv("/app/backend/.env")
from db import db
async def m():
    print(await db.requests.count_documents({}))
    await db.requests.delete_many({}); await db.slots.delete_many({}); await db.payment_transactions.delete_many({}); await db.cron_runs.delete_many({})
    print("wiped")
asyncio.run(m())
