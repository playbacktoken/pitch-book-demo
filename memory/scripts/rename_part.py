import asyncio, sys
sys.path.insert(0,"/app/backend")
from dotenv import load_dotenv; load_dotenv("/app/backend/.env")
from db import db
async def m():
    await db.facilities.update_one({"id":"main_pitch","parts.id":"main_second_half"},{"$set":{"parts.$.name":"Bottom Half (Far End)"}})
    for c in ("requests","slots","blocks"):
        await db[c].update_many({"part_id":"main_second_half"},{"$set":{"part_name":"Bottom Half (Far End)"}})
    print([p["name"] for p in (await db.facilities.find_one({"id":"main_pitch"}))["parts"]])
asyncio.run(m())
