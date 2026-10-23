import asyncio, sys
sys.path.insert(0,"/app/backend")
from dotenv import load_dotenv; load_dotenv("/app/backend/.env")
from db import db
async def m():
    r=await db.requests.find_one({"id":sys.argv[1]}); print(r["pay_token"])
asyncio.run(m())
