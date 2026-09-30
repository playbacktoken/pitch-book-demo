# Walterstown GFC Pitch Booking

A booking section for the club website where members and the public can request time slots on Walterstown GFC's pitches and facilities. The club admin reviews each request, approves or declines it, takes payment where a slot costs money, and everyone is kept informed by email.

## Who it's for
- **The public and club members** — anyone who wants to book a pitch or facility slot, either by creating an account or as a one-off guest.
- **The club admin** — the person who manages the schedule, approves requests, sets prices, and blocks off slots for matches or maintenance.

## Facilities
Carried over from the club's current SportsKey setup (dropping the two Warm Up Areas, and "Training Area" renamed to "Training Pitch"):

- **Astro** — Full, Cage 1, Cage 2, Cage 3
- **Main Pitch** — Full, Top Half (Clubhouse End), Second Half
- **Back Pitch** — Full, Half (Stafford's Side), Half (Boland's Side)
- **Training Pitch** — Full, Area 1, Area 2
- **Juvenile Pitch** (standalone)
- **Gym** (standalone)

Each facility can carry a short note (e.g. "Juvenile goalposts to be removed after each use", "Not to be booked for games needing juvenile goalposts on the 20m line") and a photo. The admin can edit both.

## The "full vs parts" rule
Several facilities are one physical space that can be booked either whole or in parts. Availability is linked so there's never a double-booking:
- Booking the **Full** blocks all of its parts for that slot.
- Booking **any part** blocks the Full for that slot.
- Parts that don't overlap can still be booked independently.

This applies to the Astro (Full ↔ Cage 1/2/3), Main Pitch (Full ↔ two halves), Back Pitch (Full ↔ two halves) and Training Pitch (Full ↔ two areas). The astro previously had fixed dividers so the full pitch couldn't be used; removing that is why the Full astro option now matters.

## Core features and experience

**Booking (public side)**
- Browse the club's facilities with a short description/note and photo for each.
- Pick a facility (or a specific part, like Cage 2), a date, and a start time.
- Choose a duration: 1-hour minimum, then 15-minute increments (1h, 1h15, 1h30 …) up to an admin-set maximum (default ~4h30), mirroring the current system.
- Optionally make it a repeat booking: pick extra weekdays and repeat weekly for up to 8 weeks (or until an end date).
- See at a glance whether a slot is free or has a price, and whether it's already taken (including when it's blocked by a "full" or "part" booking on the same space).
- Submit a booking request with name, email, and phone.
- Book as a guest, or sign in / create an account to see and track your own bookings.
- For paid slots, pay online securely by card as part of the request (for a repeat series, the total covers every session).
- Get a clear on-screen status: "Requested" → "Approved" or "Declined", plus an email at each step.

**Emails**
- Booker gets a confirmation email when their request is submitted, and another when it's approved or declined.
- The club admin gets an alert email whenever a new request comes in.
- Sent via the club's own Resend account from a club-domain address, so they work wherever the site is hosted (including Railway).

**Admin dashboard**
- Secure admin login.
- See all incoming requests in one list, with the facility/part, date, time, booker details, and payment status.
- Approve or decline each request.
- Add, edit, and remove facilities and parts, edit each facility's note and photo, and set each facility's price (or mark it free).
- Block off slots so nobody can book them (matches, maintenance, closures).
- Set the email address that receives new-request alerts.
- View an overview of what's booked across facilities.

## User flow

**Public booking**
1. Open the booking section from the club website.
2. Choose a facility (or part) and a date.
3. Pick a start time, then choose how long (duration picker).
4. Optionally repeat it — choose extra weekdays and how many weeks (up to 8) or an end date.
5. Enter contact details — as a guest, or after signing in.
6. If it's paid, complete card payment (covering all sessions for a repeat); if free, submit directly.
7. See a confirmation that the request has been sent and is awaiting club approval.
8. (Account holders) Return any time to see the status of their requests.

**Admin**
1. Log in to the admin dashboard.
2. Review pending requests and approve or decline them.
3. Manage facilities, notes, photos, prices, and blocked slots as needed.

## UI/UX feel
Clean, welcoming club-website styling — sporty and community-focused, easy for non-technical members to use on a phone. A simple slot-picker that makes availability obvious at a glance. Clear labels for free vs paid slots and for booking status. The exact colours, typography, and imagery will be set during the design step to suit the club.

## Payments
Card payments are handled by Stripe. Because you already have a Stripe account, the setup will let you claim and connect it so payouts go to the club. The admin sets a price per facility, and any facility can be free or paid, so the same booking flow covers both. For a repeat series, the total charged is the price × the number of sessions, paid upfront. Stripe's tax-handling options will be confirmed with you before going live.

## Emails
Emails are sent through your own Resend account (already connected to the club domain), so they go out from a club-domain address and keep working when the site is hosted on Railway. Three emails: a confirmation to the booker on request, an approve/decline notification to the booker, and a new-request alert to the club admin.

## Implementation phases

**Phase 1 — MVP (built now)**
- Public booking flow with the facility list above, per-facility note and photo, date/start-time picker, and availability.
- Duration picker: 1-hour minimum, 15-minute increments, up to an admin-set maximum.
- Repeat bookings: extra weekdays repeated weekly for up to 8 weeks (or an end date), handled as one request.
- Full-vs-parts linked availability across Astro, Main Pitch, Back Pitch and Training Pitch so bookings never clash.
- Guest booking and optional account creation/sign-in.
- Admin-set price per facility; free and paid slots, with Stripe card payment on paid slots (series total = price × sessions).
- Request → admin approval → approve/decline, with status shown to the booker.
- Email notifications: booker confirmation, approve/decline to booker, new-request alert to admin (via your Resend account).
- Admin dashboard: view all requests, approve/decline, manage facilities/parts, edit notes and photos, set prices, block off slots, set the admin alert email.

**Phase 2 — later**
- Season-long bookings beyond 8 weeks and team/regular-slot templates.
- Booker booking history and easy re-booking for account holders.
- Reminder emails before a booked slot.

**Phase 3 — later**
- Calendar sync (e.g. export/subscribe) and a public "what's on" view of the schedule.
- Refunds and cancellations handled in-app.
- Reporting on usage and revenue per facility.

## Assumptions
- Facilities and their parts start from the current SportsKey list (minus the two Warm Up Areas, with Training Area renamed Training Pitch); the admin can add, edit, or remove them later.
- The astro is modelled as one facility with Full + Cage 1/2/3; booking Full blocks all cages and booking any cage blocks Full.
- The same full/parts model applies to Main Pitch, Back Pitch and Training Pitch.
- Time slots use a variable duration: 1-hour minimum in 15-minute increments, up to an admin-set maximum (default ~4h30).
- Repeat bookings mirror SportsKey: pick extra weekdays and repeat weekly for up to 8 weeks or until an end date. A repeat is one request the admin approves/declines in one go; it books only the sessions where every needed slot is free, flagging/skipping any that clash; for paid facilities the total is price × the number of sessions, paid upfront.
- A submitted request marks the slot (and any overlapping full/part slots) as unavailable while awaiting approval; if declined, they reopen.
- Prices are set by the admin per facility; there are no pre-set rates baked in. For paid slots, payment is taken at the time of request; refund handling is a later phase.
- Emails send from your Resend account/club domain; you'll provide the Resend API key and the from/reply-to address, and the admin alert recipient is set in the admin dashboard.
- One admin role for the club (not separate permission levels for different officers) in the MVP.
- Bookers provide name, email, and phone; login is optional, not required.
- This is a self-contained booking section that can be linked from the existing club website, not a rebuild of the whole site.
- Times are shown in local (Irish) time.
