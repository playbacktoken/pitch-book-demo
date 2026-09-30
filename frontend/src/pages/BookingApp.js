import React, { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Header, { Crest } from "@/components/Header";
import BookingWizard from "@/components/BookingWizard";
import { StatusBadge, PriceBadge, PayBadge } from "@/components/badges";
import { fmtMoney, fmtDate } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CalendarDays,
  Clock,
  Repeat,
  Mail,
  ChevronRight,
  Search,
  Ticket,
  Sparkles,
} from "lucide-react";

export default function BookingApp() {
  const { user } = useAuth();
  const [facilities, setFacilities] = useState([]);
  const [settings, setSettings] = useState({ max_duration_minutes: 270, policy_note: "" });
  const [selected, setSelected] = useState(null);
  const wizardRef = useRef(null);
  const facRef = useRef(null);
  const myRef = useRef(null);
  const statusRef = useRef(null);
  const topRef = useRef(null);

  useEffect(() => {
    api.get("/facilities").then((r) => setFacilities(r.data));
    api.get("/settings/public").then((r) => setSettings(r.data));
  }, []);

  const scrollTo = (t) => {
    const map = { facilities: facRef, "my-bookings": myRef, status: statusRef, top: topRef };
    map[t]?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const selectFacility = (f) => {
    setSelected(f);
    setTimeout(() => wizardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };

  return (
    <div ref={topRef}>
      <Header onNav={scrollTo} />

      {/* Hero */}
      <section className="relative overflow-hidden bg-[#0b0f17] text-white">
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1531410828623-a21e67dae762?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 wgfc-field-texture opacity-40" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="max-w-2xl animate-rise">
            <div className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.25em] text-emerald-400 uppercase">
              <Crest className="h-6 w-6" /> County Meath GAA • Est. 1902 • The Blacks
            </div>
            <h1 className="mt-4 font-display text-4xl sm:text-5xl lg:text-6xl font-black uppercase leading-[0.95]">
              Reserve Pitch Time &amp; Club Facilities
            </h1>
            <p className="mt-4 text-base text-slate-300 leading-relaxed">
              Simple, transparent bookings for teams, juvenile squads, coaches and community members.
              Check real-time pitch status, book with 15-minute precision, and get instant email confirmation.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button
                onClick={() => scrollTo("facilities")}
                data-testid="hero-book-btn"
                className="h-12 px-6 text-base bg-[#15803d] hover:bg-[#166534] text-white font-bold"
              >
                Book a Pitch <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
              <Button
                onClick={() => scrollTo("status")}
                variant="outline"
                data-testid="hero-status-btn"
                className="h-12 px-6 text-base bg-white/5 border-white/25 text-white hover:bg-white/10"
              >
                Check a Booking
              </Button>
            </div>
          </div>

          <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl">
            {[
              { v: "6", l: "Facilities & Gym", Icon: Sparkles },
              { v: "15-min", l: "Slot Increments", Icon: Clock },
              { v: "Up to 8 wks", l: "Repeat Bookings", Icon: Repeat },
              { v: "Instant", l: "Email & Status", Icon: Mail },
            ].map((s) => (
              <div key={s.l} className="rounded-xl bg-white/5 border border-white/10 p-4">
                <s.Icon className="h-5 w-5 text-emerald-400" />
                <div className="mt-2 font-display text-2xl font-extrabold">{s.v}</div>
                <div className="text-xs text-slate-400 font-semibold">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Facilities */}
      <section ref={facRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <SectionHeading eyebrow="Our Grounds" title="Choose a Facility" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {facilities.map((f) => (
            <FacilityCard key={f.id} f={f} active={selected?.id === f.id} onSelect={() => selectFacility(f)} />
          ))}
        </div>

        {selected && (
          <div ref={wizardRef} className="mt-12 scroll-mt-24">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 lg:p-8 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <CalendarDays className="h-5 w-5 text-[#15803d]" />
                <h3 className="font-display text-2xl font-extrabold uppercase tracking-wide">
                  Book — {selected.name}
                </h3>
              </div>
              <BookingWizard
                key={selected.id}
                facility={selected}
                maxDuration={settings.max_duration_minutes}
                onBooked={() => scrollTo("status")}
              />
            </div>
          </div>
        )}
      </section>

      {/* My bookings */}
      {user && (
        <section ref={myRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 scroll-mt-24">
          <SectionHeading eyebrow="Your Account" title="My Bookings" />
          <MyBookings />
        </section>
      )}

      {/* Status tracker */}
      <section ref={statusRef} className="bg-[#0b0f17] text-white scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <div className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.25em] text-emerald-400 uppercase">
            <Ticket className="h-4 w-4" /> Track a Request
          </div>
          <h2 className="mt-3 font-display text-3xl lg:text-4xl font-extrabold uppercase">Check Your Booking</h2>
          <p className="mt-2 text-slate-400 max-w-xl text-sm">
            Enter your booking reference (e.g. WGFC-2000) or the email you booked with.
          </p>
          <StatusTracker />
        </div>
      </section>

      <footer className="bg-[#111827] text-slate-400 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-sm flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Crest className="h-7 w-7" />
            <span className="font-display font-bold text-white tracking-wide">WALTERSTOWN GFC</span>
          </div>
          <span>Páirc Baile an Bhuailtigh, Navan, Co. Meath • Est. 1902</span>
        </div>
      </footer>
    </div>
  );
}

function SectionHeading({ eyebrow, title }) {
  return (
    <div>
      <div className="text-xs font-bold tracking-[0.22em] uppercase text-[#15803d]">{eyebrow}</div>
      <h2 className="mt-1.5 font-display text-3xl lg:text-4xl font-extrabold uppercase text-slate-900">{title}</h2>
    </div>
  );
}

function FacilityCard({ f, active, onSelect }) {
  return (
    <div
      data-testid={`facility-card-${f.id}`}
      className="group rounded-2xl overflow-hidden border bg-white shadow-sm hover:shadow-md transition-shadow"
      style={{ borderColor: active ? "#15803d" : "#E2E8F0", borderWidth: active ? 2 : 1 }}
    >
      <div className="relative h-44 overflow-hidden">
        <img
          src={f.photo}
          alt={f.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute top-3 left-3">
          <PriceBadge isPaid={f.is_paid} />
        </div>
        <div className="absolute bottom-3 left-4 right-4">
          <div className="text-[10px] font-bold tracking-[0.18em] uppercase text-emerald-300">{f.tag}</div>
          <div className="font-display text-xl font-extrabold text-white leading-tight">{f.name}</div>
        </div>
      </div>
      <div className="p-5">
        <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">{f.note}</p>
        <div className="mt-3 flex items-center justify-between">
          <div className="text-sm">
            {f.is_paid ? (
              <span className="font-mono-nums font-bold text-slate-900">
                {fmtMoney(f.hourly_rate)}<span className="text-xs font-semibold text-slate-400">/hr</span>
              </span>
            ) : (
              <span className="font-bold text-[#047857]">Free to book</span>
            )}
          </div>
          <span className="text-xs font-semibold text-slate-400">{f.parts.length} area(s)</span>
        </div>
        <Button
          onClick={onSelect}
          data-testid={`select-facility-${f.id}`}
          className="w-full mt-4 bg-[#111827] hover:bg-[#1f2937] text-white font-bold"
        >
          Select &amp; Book <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

function BookingRow({ r }) {
  return (
    <div
      data-testid={`booking-row-${r.reference}`}
      className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between"
    >
      <div>
        <div className="flex items-center gap-2">
          <span className="font-mono-nums font-bold text-sm text-slate-900">{r.reference}</span>
          <StatusBadge status={r.status} />
        </div>
        <div className="mt-1 font-display text-lg font-bold text-slate-900 leading-tight">
          {r.facility_name} — {r.part_name}
        </div>
        <div className="text-sm text-slate-500">
          {fmtDate(r.first_date)} · {r.start_time} · {r.session_count} session(s)
        </div>
        {r.admin_note && (
          <div className="mt-1 text-xs text-slate-500 italic">Club note: {r.admin_note}</div>
        )}
      </div>
      <div className="text-right">
        <div className="font-mono-nums font-bold text-lg">{r.is_paid ? fmtMoney(r.amount) : "Free"}</div>
        <PayBadge status={r.payment_status} />
      </div>
    </div>
  );
}

function MyBookings() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    api.get("/my-bookings").then((r) => setRows(r.data)).catch(() => setRows([]));
  }, []);
  return (
    <div className="mt-6 space-y-3" data-testid="my-bookings-list">
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
          No bookings yet — pick a facility above to get started.
        </div>
      ) : (
        rows.map((r) => <BookingRow key={r.id} r={r} />)
      )}
    </div>
  );
}

function StatusTracker() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);

  const search = async (e) => {
    e?.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    const params = q.includes("@") ? { email: q } : { reference: q };
    try {
      const { data } = await api.get("/bookings/lookup", { params });
      setRows(data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 max-w-2xl">
      <form onSubmit={search} className="flex gap-2">
        <Input
          data-testid="status-search-input"
          placeholder="WGFC-2000 or your@email.ie"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="bg-white/10 border-white/20 text-white placeholder:text-slate-500"
        />
        <Button type="submit" data-testid="status-search-btn" disabled={loading}
          className="bg-[#15803d] hover:bg-[#166534] text-white">
          <Search className="h-4 w-4 mr-1" /> Find
        </Button>
      </form>
      {rows !== null && (
        <div className="mt-4 space-y-3" data-testid="status-results">
          {rows.length === 0 ? (
            <div className="text-slate-400 text-sm">No bookings found for that search.</div>
          ) : (
            rows.map((r) => (
              <div key={r.id} className="rounded-xl bg-white text-slate-900 p-4">
                <BookingRow r={r} />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
