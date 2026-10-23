import asyncio, sys, os, httpx
sys.path.insert(0,"/app/backend")
from dotenv import load_dotenv; load_dotenv("/app/backend/.env")
import emailer
async def m(to, html):
    async with httpx.AsyncClient(timeout=30) as c:
        r=await c.post(f"{emailer.EMAIL_BASE_URL}/api/v1/email/send",headers={"X-Email-Key":emailer.EMAIL_KEY},
            json={"to":[to],"subject":"Test","html":html,"from_name":emailer.EMAIL_FROM_NAME})
        print(to, r.status_code, r.text[:300])
asyncio.run(m(sys.argv[1], emailer._wrap("<p>hello</p>")))
