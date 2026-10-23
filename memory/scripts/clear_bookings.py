import asyncio, sys
sys.path.insert(0,"/app/backend")
from dotenv import load_dotenv; load_dotenv("/app/backend/.env")
from db import db
async def m():
    r=await db.requests.delete_many({}); s=await db.slots.delete_many({})
    print("requests", r.deleted_count, "slots", s.deleted_count, "blocks kept", await db.blocks.count_documents({}))
asyncio.run(m())
