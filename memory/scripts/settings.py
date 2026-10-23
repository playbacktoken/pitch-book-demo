import asyncio, sys
sys.path.insert(0,"/app/backend")
from dotenv import load_dotenv; load_dotenv("/app/backend/.env")
from db import db
async def m():
    print(await db.settings.find_one({"_id":"club"}))
    print([ (u["email"],u.get("role")) async for u in db.users.find({}, {"email":1,"role":1})])
asyncio.run(m())
