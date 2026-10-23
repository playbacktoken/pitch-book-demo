import asyncio, sys
sys.path.insert(0,"/app/backend")
from dotenv import load_dotenv; load_dotenv("/app/backend/.env")
from db import db
async def m():
    for k in ["back_pitch","training_pitch","main_pitch","astro","juvenile_pitch"]:
        await db.facilities.update_one({"id":k},{"$set":{"photo":f"/sites/{k}.jpg"}})
    print("ok")
asyncio.run(m())
