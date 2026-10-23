import asyncio, sys
sys.path.insert(0,"/app/backend")
from dotenv import load_dotenv; load_dotenv("/app/backend/.env")
from db import db
from seed import FACILITIES
async def m():
    f=[x for x in FACILITIES if x["id"]=="back_pitch"][0]
    await db.facilities.update_one({"id":"back_pitch"},{"$set":{"parts":f["parts"],"note":f["note"],"area_hint":f["area_hint"]}})
    for p in f["parts"]:
        for c in ("requests","slots","blocks"):
            await db[c].update_many({"part_id":p["id"]},{"$set":{"part_name":p["name"]}})
    d=await db.facilities.find_one({"id":"back_pitch"}); print([p["name"] for p in d["parts"]], d["note"])
asyncio.run(m())
