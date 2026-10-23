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
