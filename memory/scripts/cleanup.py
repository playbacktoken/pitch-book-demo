import asyncio, sys
sys.path.insert(0,"/app/backend")
from dotenv import load_dotenv; load_dotenv("/app/backend/.env")
from db import db
async def m(refs):
    for r in refs:
        await db.requests.delete_many({"reference":r}); await db.slots.delete_many({"reference":r})
    print("cleaned", refs)
asyncio.run(m(sys.argv[1:]))
