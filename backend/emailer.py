import os
import re
import ipaddress
import logging
import httpx
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ["EMERGENT_EMAIL_KEY"]
EMAIL_FROM_NAME = os.environ["EMAIL_FROM_NAME"]
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")


async def send_email(*, to: str, subject: str, html: str, reply_to: str | None = None):
    try:
        _assert_safe_email(subject, html)
        payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
        if reply_to or EMAIL_REPLY_TO:
            payload["contact_email"] = reply_to or EMAIL_REPLY_TO
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(f"{EMAIL_BASE_URL}/api/v1/email/send",
                                     headers={"X-Email-Key": EMAIL_KEY}, json=payload)
        resp.raise_for_status()
        return resp.json().get("id")
    except Exception as e:
        logger.error(f"Email send error: {str(e)}")
        return None


def _wrap(inner: str) -> str:
    return (f'<table role="presentation" width="100%" style="background:#F8FAFC;padding:24px 0">'
            f'<tr><td align="center">'
            f'<table role="presentation" width="560" style="background:#FFFFFF;border:1px solid #E2E8F0;'
            f'border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif">'
            f'<tr><td style="background:#111827;padding:20px 28px">'
            f'<img src="https://customer-assets-39nsmqrw.emergentagent.net/job_577e4300-2fa0-4703-82a1-8041cd38c03f/artifacts/a79fd76ae7e56c32_walterstown%20logo.jpg" '
            f'alt="Walterstown GFC" width="56" height="56" style="display:block;margin-bottom:10px;border-radius:8px">'
            f'<span style="color:#FFFFFF;font-size:20px;font-weight:800;letter-spacing:1px">WALTERSTOWN GFC</span>'
            f'<span style="color:#15803D;font-size:12px;display:block;letter-spacing:2px">PITCH &amp; FACILITY BOOKINGS</span>'
            f'</td></tr>'
            f'<tr><td style="padding:28px">{inner}'
            f'<p style="font-size:12px;color:#94A3B8;margin-top:28px">Sent by Walterstown GFC. '
            f'We never ask for your password or card details by email.</p>'
            f'</td></tr></table></td></tr></table>')


def _details_block(req: dict) -> str:
    rows = [
        ("Reference", req.get("reference", "")),
        ("Facility", f'{req.get("facility_name","")} — {req.get("part_name","")}'),
        ("Sessions", str(req.get("session_count", 1))),
        ("Status", req.get("status", "").upper()),
    ]
    cells = "".join(
        f'<tr><td style="padding:6px 0;color:#64748B;font-size:13px">{escape(str(k))}</td>'
        f'<td style="padding:6px 0;color:#0F172A;font-size:13px;font-weight:700" align="right">{escape(str(v))}</td></tr>'
        for k, v in rows)
    return f'<table role="presentation" width="100%" style="border-top:1px solid #E2E8F0;margin:16px 0">{cells}</table>'


async def send_booking_confirmation(req: dict):
    inner = (f'<h2 style="color:#0F172A;font-size:20px;margin:0 0 8px">Booking request received</h2>'
             f'<p style="color:#475569;font-size:14px">Hi {escape(req.get("booker_name",""))}, we have received your '
             f'booking request. The club will review it and email you when it is approved or declined.</p>{_details_block(req)}')
    return await send_email(to=req["email"], subject=f'Booking request received — {req.get("reference","")}', html=_wrap(inner))


async def send_status_update(req: dict):
    approved = req.get("status") == "approved"
    heading = "Booking approved" if approved else "Booking declined"
    color = "#15803D" if approved else "#B91C1C"
    msg = ("your booking has been approved." if approved
           else "your booking request has been declined.")
    note = req.get("admin_note")
    note_html = (f'<p style="color:#475569;font-size:14px;background:#F1F5F9;padding:12px;border-radius:8px">'
                 f'<strong>Note from the club:</strong> {escape(str(note))}</p>') if note else ""
    inner = (f'<h2 style="color:{color};font-size:20px;margin:0 0 8px">{heading}</h2>'
             f'<p style="color:#475569;font-size:14px">Hi {escape(req.get("booker_name",""))}, {msg}</p>'
             f'{note_html}{_details_block(req)}')
    return await send_email(to=req["email"], subject=f'{heading} — {req.get("reference","")}', html=_wrap(inner))


async def send_admin_alert(req: dict, admin_email: str):
    inner = (f'<h2 style="color:#0F172A;font-size:20px;margin:0 0 8px">New booking request</h2>'
             f'<p style="color:#475569;font-size:14px">A new booking request is waiting for approval.</p>'
             f'<table role="presentation" width="100%" style="margin:8px 0">'
             f'<tr><td style="color:#64748B;font-size:13px;padding:4px 0">Booker</td>'
             f'<td align="right" style="font-size:13px;font-weight:700;padding:4px 0">{escape(req.get("booker_name",""))}</td></tr>'
             f'<tr><td style="color:#64748B;font-size:13px;padding:4px 0">Email</td>'
             f'<td align="right" style="font-size:13px;padding:4px 0">{escape(req.get("email",""))}</td></tr>'
             f'<tr><td style="color:#64748B;font-size:13px;padding:4px 0">Phone</td>'
             f'<td align="right" style="font-size:13px;padding:4px 0">{escape(req.get("phone",""))}</td></tr>'
             f'</table>{_details_block(req)}')
    return await send_email(to=admin_email, subject=f'New booking request — {req.get("reference","")}', html=_wrap(inner))
