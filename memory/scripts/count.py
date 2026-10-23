import asyncio, sys
sys.path.insert(0,"/app/backend")
from dotenv import load_dotenv; load_dotenv("/app/backend/.env")
from db import db
async def m(): print("requests", await db.requests.count_documents({}), "slots", await db.slots.count_documents({}))
asyncio.run(m())
