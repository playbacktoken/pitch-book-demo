import asyncio, sys
sys.path.insert(0,"/app/backend")
from dotenv import load_dotenv; load_dotenv("/app/backend/.env")
from db import db
async def m():
    await db.settings.update_one({"_id":"club"},{"$set":{"alert_email":"niallreynolds7@gmail.com"}})
    await db.users.update_one({"email":"niallreynolds7@gmail.com"},{"$set":{"role":"admin"}})
    print(await db.settings.find_one({"_id":"club"},{"alert_email":1}), await db.users.find_one({"email":"niallreynolds7@gmail.com"},{"role":1,"_id":0}))
asyncio.run(m())
