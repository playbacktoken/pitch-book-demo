import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  START_TIMES,
  durationOptions,
  fmtDuration,
  endTime,
  overlaps,
  toMinutes,
  fromMinutes,
  fmtMoney,
  WEEKDAYS,
  todayISO,
  addDaysISO,
} from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Calendar,
  Clock,
  Repeat,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  MapPin,
} from "lucide-react";

const HOURS = Array.from({ length: 15 }, (_, i) => 7 + i); // 07:00 - 21:00

export default function BookingWizard({ facility, maxDuration, onBooked }) {
  const { user } = useAuth();
  const [partId, setPartId] = useState(facility.parts[0].id);
  const [date, setDate] = useState(todayISO());
  const [start, setStart] = useState("18:00");
  const [duration, setDuration] = useState(facility.fixed_duration_minutes || 60);
  const [repeatOn, setRepeatOn] = useState(false);
  const [weekdays, setWeekdays] = useState([]);
  const [weeks, setWeeks] = useState(4);
  const [occupied, setOccupied] = useState([]);
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [booker, setBooker] = useState({ name: "", email: "", phone: "", notes: "" });

  useEffect(() => {
    if (user) setBooker((b) => ({ ...b, name: user.name || "", email: user.email || "", phone: user.phone || "" }));
  }, [user]);

  const part = useMemo(() => facility.parts.find((p) => p.id === partId), [facility, partId]);
  const zones = useMemo(() => new Set(part?.zones || []), [part]);

  const loadAvailability = async () => {
    setLoadingAvail(true);
    try {
      const { data } = await api.get("/availability", { params: { facility_id: facility.id, date } });
      setOccupied(data.occupied || []);
    } catch {
      setOccupied([]);
    } finally {
      setLoadingAvail(false);
    }
  };

  useEffect(() => {
    loadAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facility.id, date]);

  const end = endTime(start, duration);
  const rate = facility.hourly_rate * (part?.rate_multiplier || 1);
  const perSession = facility.is_paid ? Math.round(rate * (duration / 60) * 100) / 100 : 0;
  const isPaid = facility.is_paid && perSession > 0;

  const relevant = useMemo(
    () =>
      occupied
        .filter((o) => (o.zones || []).some((z) => zones.has(z)))
        .map((o) => ({ ...o, part_name: o.part_name || facility.parts.find((p) => p.id === o.part_id)?.name || "" })),
    [occupied, zones, facility]
  );

  const selectionConflict = useMemo(() => {
    for (const o of occupied) {
      const oz = new Set(o.zones || []);
      const intersects = [...zones].some((z) => oz.has(z));
      if (intersects && overlaps(start, end, o.start_time, o.end_time)) return true;
    }
    return false;
  }, [occupied, zones, start, end]);

  const estSessions = repeatOn ? Math.max(1, weeks) * Math.max(1, new Set([...weekdays]).size || 1) : 1;
  const estTotal = perSession * estSessions;

  const toggleWeekday = (i) =>
    setWeekdays((w) => (w.includes(i) ? w.filter((x) => x !== i) : [...w, i]));

  const submit = async () => {
    if (!booker.name || !booker.email) {
      toast.error("Please enter your name and email.");
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post("/bookings", {
        facility_id: facility.id,
        part_id: partId,
        first_date: date,
        start_time: start,
        duration_minutes: duration,
        repeat: { enabled: repeatOn, weekdays, weeks },
        booker_name: booker.name,
        email: booker.email,
        phone: booker.phone,
        notes: booker.notes,
        origin_url: window.location.origin,
      });
      if (data.checkout_url) {
        toast.info("Going to payment…");
        window.location.href = data.checkout_url;
        return;
      }
      const skipped = data.skipped_dates?.length;
      toast.success(
        `Request ${data.request.reference} sent. ${data.booked_dates.length} session(s) waiting for approval.` +
          (skipped ? ` ${skipped} date(s) already booked were left out.` : "")
      );
      onBooked?.(data.request);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6" data-testid="booking-wizard">
      {/* left: pickers */}
      <div className="lg:col-span-3 space-y-6">
        {/* part selector */}
        <div>
          <div className="text-xs font-semibold tracking-wider uppercase text-slate-500 mb-2 flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" /> Choose area
          </div>
          <div className="flex flex-wrap gap-2">
            {facility.parts.map((p) => (
              <button
                key={p.id}
                data-testid={`part-pill-${p.id}`}
                onClick={() => setPartId(p.id)}
                className="px-3.5 py-2 rounded-full text-sm font-bold border transition-colors"
                style={
                  partId === p.id
                    ? { background: "#111827", color: "#fff", borderColor: "#111827" }
                    : { background: "#fff", color: "#334155", borderColor: "#E2E8F0" }
                }
              >
                {p.name}
              </button>
            ))}
          </div>
          {facility.area_hint && (
            <p className="mt-2 text-xs text-slate-500" data-testid="area-hint">{facility.area_hint}</p>
          )}
        </div>

        {/* date */}
        <div>
          <div className="text-xs font-semibold tracking-wider uppercase text-slate-500 mb-2 flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" /> Date
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {[
              { label: "Today", v: todayISO() },
              { label: "Tomorrow", v: addDaysISO(todayISO(), 1) },
            ].map((q) => (
              <button
                key={q.label}
                data-testid={`date-quick-${q.label.toLowerCase()}`}
                onClick={() => setDate(q.v)}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-slate-200 hover:border-[#15803d] transition-colors"
                style={date === q.v ? { background: "#DCFCE7", borderColor: "#15803d", color: "#166534" } : {}}
              >
                {q.label}
              </button>
            ))}
            <Input
              type="date"
              min={todayISO()}
              value={date}
              data-testid="booking-date"
              onChange={(e) => setDate(e.target.value)}
              className="w-auto"
            />
          </div>
        </div>

        {/* time + duration */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-semibold tracking-wider uppercase text-slate-500 mb-2 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> Start time
            </div>
            <select
              value={start}
              data-testid="booking-start"
              onChange={(e) => setStart(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm font-mono-nums font-bold bg-white"
            >
              {START_TIMES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-xs font-semibold tracking-wider uppercase text-slate-500 mb-2">Duration</div>
            <select
              value={duration}
              data-testid="booking-duration"
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm font-bold bg-white"
            >
              {(facility.fixed_duration_minutes ? [facility.fixed_duration_minutes] : durationOptions(maxDuration)).map((m) => (
                <option key={m} value={m}>{fmtDuration(m)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* availability timeline */}
        <div>
          <div className="text-xs font-semibold tracking-wider uppercase text-slate-500 mb-2 flex items-center justify-between">
            <span>Availability — {part?.name}</span>
            {loadingAvail && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          </div>
          <DayTimeline occupied={relevant} start={start} end={end} onPick={setStart} clash={selectionConflict} />
        </div>

        {/* repeat */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Repeat className="h-4 w-4 text-[#15803d]" /> Repeat weekly
            </div>
            <Switch checked={repeatOn} onCheckedChange={setRepeatOn} data-testid="repeat-toggle" />
          </div>
          {repeatOn && (
            <div className="mt-3 space-y-3">
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1.5">Also repeat on these weekdays</div>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((w) => (
                    <button
                      key={w.i}
                      data-testid={`weekday-${w.label.toLowerCase()}`}
                      onClick={() => toggleWeekday(w.i)}
                      className="px-2.5 py-1 rounded-md text-xs font-bold border transition-colors"
                      style={
                        weekdays.includes(w.i)
                          ? { background: "#15803d", color: "#fff", borderColor: "#15803d" }
                          : { background: "#fff", color: "#475569", borderColor: "#E2E8F0" }
                      }
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs">Number of weeks (max 8)</Label>
                <select
                  value={weeks}
                  data-testid="repeat-weeks"
                  onChange={(e) => setWeeks(Number(e.target.value))}
                  className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm font-bold bg-white mt-1"
                >
                  {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>{n} weeks</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* right: summary + booker */}
      <div className="lg:col-span-2 space-y-4">
        <div className="rounded-xl border border-slate-200 bg-[#111827] text-white p-5">
          <div className="font-display text-xl font-extrabold uppercase tracking-wide">{facility.name}</div>
          <div className="text-sm text-slate-300">{part?.name}</div>

          {selectionConflict ? (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-500/15 text-red-300 px-3 py-2 text-sm font-semibold" data-testid="conflict-warning">
              <AlertTriangle className="h-4 w-4" /> This time is already booked. Please choose another.
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-500/15 text-emerald-300 px-3 py-2 text-sm font-semibold">
              <CheckCircle2 className="h-4 w-4" /> Slot available
            </div>
          )}

          <div className="mt-4 space-y-1.5 text-sm">
            <Row k="When" v={`${start}–${end}`} />
            <Row k="Duration" v={fmtDuration(duration)} />
            {isPaid && <Row k="Per session" v={fmtMoney(perSession)} />}
            {repeatOn && <Row k="Sessions" v={`up to ${estSessions}`} />}
          </div>
          {isPaid && (
            <div className="mt-3 border-t border-white/10 pt-3 flex items-center justify-between">
              <span className="text-sm text-slate-300">Total (payable now)</span>
              <span className="font-mono-nums text-2xl font-bold" data-testid="booking-total">{fmtMoney(estTotal)}</span>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <Tabs defaultValue="guest">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="guest" data-testid="tab-guest">Book as Guest</TabsTrigger>
              <TabsTrigger value="member" data-testid="tab-member">{user ? "Signed In" : "Member"}</TabsTrigger>
            </TabsList>
            <TabsContent value="guest" className="pt-2">
              <BookerFields booker={booker} setBooker={setBooker} />
            </TabsContent>
            <TabsContent value="member" className="pt-2">
              {user ? (
                <p className="text-sm text-slate-600">
                  Booking as <strong>{user.name}</strong> ({user.email}).
                </p>
              ) : (
                <p className="text-sm text-slate-600">
                  Sign in using the <strong>Sign In / Join</strong> button at the top, or book as a guest.
                </p>
              )}
              <div className="mt-2">
                <BookerFields booker={booker} setBooker={setBooker} />
              </div>
            </TabsContent>
          </Tabs>

          <Button
            onClick={submit}
            disabled={submitting || selectionConflict}
            data-testid="submit-booking-button"
            className="w-full mt-4 h-11 text-base bg-[#15803d] hover:bg-[#166534] text-white font-bold"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : isPaid ? (
              <CreditCard className="h-4 w-4 mr-2" />
            ) : null}
            {isPaid ? `Pay ${fmtMoney(estTotal)} & Request` : "Send Request"}
          </Button>
          <p className="mt-2 text-[11px] text-slate-400 text-center">
            Your booking is confirmed once the club approves it.
          </p>
        </div>
      </div>
    </div>
  );
}

const HOUR_PX = 44;

function DayTimeline({ occupied, start, end, onPick, clash }) {
  const top = (t) => ((toMinutes(t) - HOURS[0] * 60) / 60) * HOUR_PX;
  const sorted = [...occupied].sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time));
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3" data-testid="availability-timeline">
      <div className="relative overflow-hidden" style={{ height: HOURS.length * HOUR_PX }}>
        {HOURS.map((h, i) => (
          <button
            key={h}
            type="button"
            onClick={() => onPick(fromMinutes(h * 60))}
            data-testid={`timeline-hour-${h}`}
            className="absolute left-0 right-0 flex items-start border-t border-slate-100 hover:bg-slate-50 transition-colors"
            style={{ top: i * HOUR_PX, height: HOUR_PX }}
          >
            <span className="w-14 pt-1 text-left text-xs font-mono-nums font-bold text-slate-400">
              {String(h).padStart(2, "0")}:00
            </span>
          </button>
        ))}
        {sorted.map((o, i) => (
          <div
            key={i}
            data-testid={`timeline-existing-${i}`}
            className={`absolute left-16 right-2 rounded-lg px-3 py-1 text-xs font-semibold overflow-hidden pointer-events-none ${
              o.type === "block" ? "diag-blocked text-slate-700" : o.status === "approved" ? "bg-slate-800 text-white" : "bg-slate-300 text-slate-800"
            }`}
            style={{ top: top(o.start_time), height: Math.max(top(o.end_time) - top(o.start_time), 18) }}
          >
            {o.start_time}–{o.end_time} · {o.part_name}
            {" · "}
            {o.type === "block" ? `Unavailable${o.reason ? ` (${o.reason})` : ""}` : o.status === "approved" ? "Booked" : "Requested"}
          </div>
        ))}
        <div
          className={`absolute left-16 right-2 rounded-lg border-2 border-dashed pointer-events-none ${clash ? "border-red-500" : "border-[#15803d] bg-emerald-50/60"}`}
          style={{ top: top(start), height: top(end) - top(start) }}
          data-testid="timeline-selection"
        >
          <span className={`absolute right-2 top-1 text-[11px] font-bold ${clash ? "text-red-600" : "text-[#15803d]"}`}>Your time {start}–{end}</span>
        </div>
      </div>
      {sorted.length === 0 && (
        <p className="pt-2 text-xs text-slate-500" data-testid="timeline-empty">No bookings on this day yet.</p>
      )}
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400">{k}</span>
      <span className="font-mono-nums font-bold">{v}</span>
    </div>
  );
}

function BookerFields({ booker, setBooker }) {
  return (
    <div className="space-y-2.5">
      <div>
        <Label htmlFor="bk-name" className="text-xs">Full name</Label>
        <Input id="bk-name" data-testid="booker-name" value={booker.name}
          onChange={(e) => setBooker({ ...booker, name: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="bk-email" className="text-xs">Email</Label>
        <Input id="bk-email" type="email" data-testid="booker-email" value={booker.email}
          onChange={(e) => setBooker({ ...booker, email: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="bk-phone" className="text-xs">Phone</Label>
        <Input id="bk-phone" data-testid="booker-phone" value={booker.phone}
          onChange={(e) => setBooker({ ...booker, phone: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="bk-notes" className="text-xs">Team / notes (optional)</Label>
        <Textarea id="bk-notes" rows={2} data-testid="booker-notes" value={booker.notes}
          onChange={(e) => setBooker({ ...booker, notes: e.target.value })} />
      </div>
    </div>
  );
}
