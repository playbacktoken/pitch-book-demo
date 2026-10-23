import asyncio, sys
sys.path.insert(0,"/app/backend")
from dotenv import load_dotenv; load_dotenv("/app/backend/.env")
from db import db
from seed import FACILITIES
async def m():
    f=[x for x in FACILITIES if x["id"]=="astro"][0]
    await db.facilities.update_one({"id":"astro"},{"$set":{"parts":f["parts"],"note":f["note"]}})
    for p in f["parts"]:
        for c in ("requests","slots","blocks"):
            await db[c].update_many({"part_id":p["id"]},{"$set":{"part_name":p["name"]}})
    d=await db.facilities.find_one({"id":"astro"}); print([p["name"] for p in d["parts"]], d["note"])
asyncio.run(m())
