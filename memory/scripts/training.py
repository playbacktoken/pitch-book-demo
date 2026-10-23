import asyncio, sys
sys.path.insert(0,"/app/backend")
from dotenv import load_dotenv; load_dotenv("/app/backend/.env")
from db import db
from seed import FACILITIES
async def m():
    for k in ("training_pitch","juvenile_pitch"):
        f=[x for x in FACILITIES if x["id"]==k][0]
        await db.facilities.update_one({"id":k},{"$set":{"parts":f["parts"],"note":f["note"]}})
        d=await db.facilities.find_one({"id":k}); print(k,[p["name"] for p in d["parts"]], d["note"])
    print("area slots", await db.slots.count_documents({"part_id":{"$in":["train_area_1","train_area_2"]}}))
asyncio.run(m())
