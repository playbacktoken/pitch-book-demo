import asyncio, sys, re
sys.path.insert(0,"/app/backend")
from dotenv import load_dotenv; load_dotenv("/app/backend/.env")
from db import db
import emailer
async def m(rid):
    r=await db.requests.find_one({"id":rid})
    print(re.sub("<[^>]+>"," | ",await emailer._details_block(r)).replace(" |  | "," | "))
asyncio.run(m(sys.argv[1]))
