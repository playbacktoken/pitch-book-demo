# Walterstown GFC — Pitch & Facility Booking

## Original problem statement
A booking section for the Walterstown GFC (GAA club, Navan, Co. Meath) website. Public/members
request pitch/facility slots; admin approves/declines, takes card payment on paid slots, and
everyone is kept informed by email.

## Architecture
- Frontend: React (CRA + craco), Tailwind, shadcn/ui, sonner, lucide-react. Fonts: Barlow Condensed (display), Plus Jakarta Sans (body), JetBrains Mono (numbers).
- Backend: FastAPI + Motor (MongoDB). Modules: server.py, auth.py (JWT cookie auth), emailer.py, seed.py, db.py.
- Integrations: Stripe (Flow A claimable sandbox, dynamic price_data checkout); Emergent-managed email (Resend proxy).

## User personas
- Public/guest booker (name+email+phone, no account).
- Club member (JWT account, sees "My Bookings").
- Club admin (single admin role, /admin dashboard).

## Core requirements (static)
- 6 facilities with parts+linked (full↔parts) zone availability; per-facility note, photo, price.
- Duration 1h min, 15-min steps, up to admin max (default 270). Repeat weekly up to 8 weeks.
- Free vs paid slots; Stripe payment upfront for paid (total = per-session × sessions).
- Request → Approved/Declined; status visible to booker; email at submit + decision + admin alert.
- Admin: view/filter/approve/decline, manage facilities/parts/notes/photos/prices, block slots, set alert email.

## Implemented (2026-06, MVP)
- [x] Public homepage: hero, 6 facility cards (FREE/PAID badges, photos), status tracker.
- [x] Booking wizard: part pills, date + quick toggles, start time, duration, availability timeline, repeat, live price, guest/member booker.
- [x] Full-vs-parts conflict engine (zones + time overlap) across Astro/Main/Back/Training.
- [x] Guest + JWT member auth (register/login/me/logout, bcrypt, brute-force lockout).
- [x] Stripe Flow A checkout for paid slots; /payment/success polling + /payment/cancel.
- [x] Emails: booker confirmation, approve/decline, admin alert (Emergent managed email).
- [x] Admin dashboard: Requests (filter/approve/decline+note), Facilities CRUD, Block slots, Settings.
- [x] Seed: 6 facilities, sample bookings WGFC-1000..1003, club settings.
- [x] Backend tested 21/21; frontend flows verified.

## Known notes / deviations
- Email sends via Emergent-managed Resend (platform-verified domain, display name "Walterstown GFC"),
  NOT the club's own Resend key / club-domain from-address. Works everywhere incl. Railway.
- Stripe tax mode = DIY (no tax added) for MVP; can switch to Stripe-calculates or Stripe-managed later.
- Facility photos edited via URL (no file upload in MVP).

## Backlog
- P1: Club's own Resend domain sender; facility photo upload (object storage).
- P1: Booker booking history + easy re-booking; reminder emails.
- P2: Season-long bookings >8 weeks, team/slot templates.
- P2: Calendar sync/export, public "what's on" schedule.
- P2: In-app refunds & cancellations; usage/revenue reporting.

## Credentials
- Admin: admin@walterstowngfc.ie / Walterstown1902 (see /app/memory/test_credentials.md)

## 2026-06 Copy cleanup
- Rewrote all visible text (public pages, booking steps, admin, emails, facility names/notes) in plain club-notice style.
- Removed made-up details (Est. 1902, "The Blacks", Irish pitch names, equipment/floodlight claims) and the hero stats strip.
- Facilities renamed: Astro, Main Pitch, Back Pitch, Training Pitch, Juvenile Pitch, Gym (DB synced).
- 2026-06: Club crest (frontend/public/logo.jpg) used in header, hero, footer, admin, payment pages, favicon and email header.
- 2026-06: Only Astro is paid. Main Pitch & Gym set free (seed + DB). Free/Paid badges and price text hidden for free facilities; 'Paid Slot' shown only on Astro.
- 2026-06: Availability now a single-column day timeline showing existing bookings/blocks (time, area, status); click an hour to set start time. Availability API returns part_name.
- 2026-06: Astro pricing: Full €160/hr, each cage €52/hr (rate_multiplier 0.325). Astro fixed to 1-hour slots (facility.fixed_duration_minutes=60, enforced in API; admin toggle '1-hour slots only').
- 2026-06: Astro pay-after-approval. No charge at request. On approval: pay_token + 6h window on first session; approval email has "Pay now" link to /pay/:id?t=token (pay next week or all remaining). Cron `.emergent/crons.yml` astro-payments (*/15) -> POST /api/cron/payments (Bearer WEBHOOK_CRON_SECRET): removes unpaid sessions past deadline (status cancelled, email), opens 6h window + emails link the day before each unpaid weekly session. Code: backend/payflow.py. Slot fields: pay_status, pay_due_at. Request payment_status: not_due/due/partial/paid/expired.
- 2026-06: Site map (frontend/public/sitemap.png) via components/SiteMap.js: clickable on home (left of cards), highlighted chosen pitch/cage/half in booking section (not gym). Card photos = crops in public/sites/*.jpg (gym keeps stock). Training areas 1/2 not mapped separately (location unknown).
- 2026-06: alert_email set to niallreynolds7@gmail.com; that user promoted to admin.
- 2026-06: Blocks support date ranges (From/To, max 1 year) + All day; stored per-day with group_id, listed/deleted as a group; API warns on clashing existing bookings.
