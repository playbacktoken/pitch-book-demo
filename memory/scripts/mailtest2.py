import asyncio, sys
sys.path.insert(0,"/app/backend")
from dotenv import load_dotenv; load_dotenv("/app/backend/.env")
import emailer
req={"email":"delivered@resend.dev","booker_name":"Pay Test","reference":"WGFC-TEST","facility_name":"Astro","part_name":"Cage 1","session_count":3,"status":"approved","start_time":"19:00"}
pay={"url":"https://chat-first-dev-1.preview.emergentagent.com/pay/x?t=y","due":"Fri 24 Oct, 21:00","next_amount":52.0,"all_amount":156.0,"count":3}
async def m():
    print(await emailer.send_status_update(req, pay)); print(await emailer.send_payment_due(req, ["2026-11-01"], pay)); print(await emailer.send_payment_expired(req, ["2026-11-01"]))
asyncio.run(m())
