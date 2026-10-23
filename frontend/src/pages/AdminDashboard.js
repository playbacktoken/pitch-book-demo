import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Crest } from "@/components/Header";
import { StatusBadge, PriceBadge, PayBadge } from "@/components/badges";
import { fmtMoney, fmtDate, START_TIMES, durationOptions, fmtDuration, todayISO } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Home, LogOut, Loader2, Check, X, Plus, Trash2, Pencil, Ban, Settings as SettingsIcon, Shield,
} from "lucide-react";

const FILTERS = ["all", "requested", "approved", "declined", "cancelled"];

export default function AdminDashboard() {
  const { user, ready, login, logout } = useAuth();
  const navigate = useNavigate();

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0f17]">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return <AdminLogin onLogin={login} isMember={!!user} onLogout={logout} />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#111827] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Crest className="h-11 w-11" />
            <div>
              <div className="font-display text-lg font-extrabold tracking-wide">ADMIN PORTAL</div>
              <div className="text-[10px] tracking-[0.18em] text-emerald-400 font-semibold">WALTERSTOWN GFC</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/">
              <Button variant="outline" size="sm" className="bg-white/5 border-white/20 text-white hover:bg-white/10">
                <Home className="h-4 w-4 mr-1" /> Site
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={() => { logout(); navigate("/"); }}
              className="bg-white/5 border-white/20 text-white hover:bg-white/10" data-testid="admin-logout-btn">
              <LogOut className="h-4 w-4 mr-1" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="requests">
          <TabsList className="grid grid-cols-4 w-full max-w-2xl">
            <TabsTrigger value="requests" data-testid="admin-tab-requests">Requests</TabsTrigger>
            <TabsTrigger value="facilities" data-testid="admin-tab-facilities">Facilities</TabsTrigger>
            <TabsTrigger value="blocks" data-testid="admin-tab-blocks">Block Slots</TabsTrigger>
            <TabsTrigger value="settings" data-testid="admin-tab-settings">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="requests" className="mt-6"><RequestsTab /></TabsContent>
          <TabsContent value="facilities" className="mt-6"><FacilitiesTab /></TabsContent>
          <TabsContent value="blocks" className="mt-6"><BlocksTab /></TabsContent>
          <TabsContent value="settings" className="mt-6"><SettingsTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function AdminLogin({ onLogin, isMember, onLogout }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const u = await onLogin(email, password);
      if (u.role !== "admin") toast.error("This account is not an admin.");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f17] flex items-center justify-center px-4">
      <form onSubmit={submit} className="max-w-sm w-full rounded-2xl border border-white/10 bg-white/5 p-8 animate-rise" data-testid="admin-login-form">
        <div className="flex justify-center mb-4"><Crest className="h-20 w-20" /></div>
        <h1 className="text-center font-display text-2xl font-extrabold uppercase text-white flex items-center justify-center gap-2">
          <Shield className="h-5 w-5 text-emerald-400" /> Admin Login
        </h1>
        {isMember && (
          <p className="mt-2 text-center text-xs text-amber-300">
            You're signed in but not an admin. <button type="button" onClick={onLogout} className="underline">Switch account</button>
          </p>
        )}
        <div className="mt-5 space-y-3">
          <div>
            <Label className="text-slate-300">Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required
              data-testid="admin-login-email" className="bg-white/10 border-white/20 text-white" />
          </div>
          <div>
            <Label className="text-slate-300">Password</Label>
            <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required
              data-testid="admin-login-password" className="bg-white/10 border-white/20 text-white" />
          </div>
          <Button type="submit" disabled={loading} data-testid="admin-login-submit"
            className="w-full bg-[#15803d] hover:bg-[#166534] text-white">
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Sign In
          </Button>
        </div>
      </form>
    </div>
  );
}

function RequestsTab() {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [decision, setDecision] = useState(null); // {req, action}
  const [note, setNote] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await api.get("/admin/requests", { params: filter === "all" ? {} : { status: filter } });
    setRows(data);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const decide = async () => {
    const { req, action } = decision;
    try {
      await api.post(`/admin/requests/${req.id}/${action}`, { note });
      toast.success(`${req.reference} ${action === "approve" ? "approved" : "declined"}. The booker has been emailed${action === "approve" && req.is_paid ? " a payment link" : ""}.`);
      setDecision(null); setNote("");
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-5">
        {FILTERS.map((f) => (
          <button key={f} data-testid={`filter-${f}`} onClick={() => setFilter(f)}
            className="px-3.5 py-1.5 rounded-full text-sm font-bold capitalize border transition-colors"
            style={filter === f ? { background: "#111827", color: "#fff", borderColor: "#111827" }
              : { background: "#fff", color: "#475569", borderColor: "#E2E8F0" }}>
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500">No requests.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} data-testid={`admin-request-${r.reference}`}
              className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono-nums font-bold text-sm">{r.reference}</span>
                    <StatusBadge status={r.status} />
                    <PriceBadge isPaid={r.is_paid} />
                    <PayBadge status={r.payment_status} />
                  </div>
                  <div className="mt-1 font-display text-lg font-bold">{r.facility_name} — {r.part_name}</div>
                  <div className="text-sm text-slate-500">
                    {r.slots.map((s) => `${fmtDate(s.date)} ${s.start_time}–${s.end_time}${s.status === "cancelled" ? " (removed)" : s.pay_status === "paid" ? " (paid)" : ""}`).join("  •  ")}
                  </div>
                  <div className="text-sm text-slate-600 mt-1">
                    <strong>{r.booker_name}</strong> · {r.email} · {r.phone || "no phone"}
                    {r.notes ? ` · "${r.notes}"` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="font-mono-nums font-bold text-lg mr-2">{r.is_paid ? fmtMoney(r.amount) : ""}</div>
                  {r.status === "requested" && (
                    <>
                      <Button size="sm" onClick={() => { setDecision({ req: r, action: "approve" }); setNote(""); }}
                        data-testid={`approve-btn-${r.reference}`} className="bg-[#15803d] hover:bg-[#166534] text-white">
                        <Check className="h-4 w-4 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setDecision({ req: r, action: "decline" }); setNote(""); }}
                        data-testid={`decline-btn-${r.reference}`} className="text-red-600 border-red-200 hover:bg-red-50">
                        <X className="h-4 w-4 mr-1" /> Decline
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!decision} onOpenChange={(o) => !o && setDecision(null)}>
        <DialogContent data-testid="decision-dialog">
          <DialogHeader>
            <DialogTitle className="font-display uppercase">
              {decision?.action === "approve" ? "Approve" : "Decline"} {decision?.req.reference}
            </DialogTitle>
          </DialogHeader>
          <div>
            <Label>Note to booker (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} data-testid="decision-note"
              placeholder={decision?.action === "decline" ? "e.g. Pitch waterlogged / county fixture clash" : "e.g. Floodlights will be on"} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecision(null)}>Cancel</Button>
            <Button onClick={decide} data-testid="decision-confirm"
              className={decision?.action === "approve" ? "bg-[#15803d] text-white" : "bg-red-600 text-white"}>
              Confirm {decision?.action}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const emptyFacility = { name: "", tag: "", note: "", photo: "", is_paid: false, hourly_rate: 0, active: true, order: 99, parts: [] };

function FacilitiesTab() {
  const [facs, setFacs] = useState([]);
  const [editing, setEditing] = useState(null);

  const load = async () => setFacs((await api.get("/facilities")).data);
  useEffect(() => { load(); }, []);

  const save = async (f) => {
    try {
      if (f.id && facs.find((x) => x.id === f.id)) await api.put(`/admin/facilities/${f.id}`, f);
      else await api.post("/admin/facilities", f);
      toast.success("Facility saved");
      setEditing(null);
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Remove this facility?")) return;
    await api.delete(`/admin/facilities/${id}`);
    toast.success("Facility removed");
    load();
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setEditing({ ...emptyFacility })} data-testid="add-facility-btn"
          className="bg-[#111827] text-white"><Plus className="h-4 w-4 mr-1" /> Add facility</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {facs.map((f) => (
          <div key={f.id} data-testid={`admin-facility-${f.id}`} className="rounded-xl border border-slate-200 bg-white p-4 flex gap-3">
            <img src={f.photo} alt={f.name} className="h-20 w-20 rounded-lg object-cover" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="font-display text-lg font-bold truncate">{f.name}</div>
                {!f.active && <span className="text-xs text-slate-400">(hidden)</span>}
              </div>
              <div className="text-sm text-slate-500">{f.is_paid ? `${fmtMoney(f.hourly_rate)}/hr · ` : ""}{f.parts.length} area(s)</div>
              <p className="text-xs text-slate-500 line-clamp-2 mt-1">{f.note}</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing({ ...f })} data-testid={`edit-facility-${f.id}`}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
                <Button size="sm" variant="outline" onClick={() => remove(f.id)} className="text-red-600 border-red-200">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && <FacilityEditor facility={editing} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}

function FacilityEditor({ facility, onSave, onClose }) {
  const [f, setF] = useState(facility);
  const up = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const upPart = (i, k, v) => setF((p) => {
    const parts = [...p.parts]; parts[i] = { ...parts[i], [k]: v }; return { ...p, parts };
  });
  const addPart = () => setF((p) => ({ ...p, parts: [...p.parts, { name: "", rate_multiplier: 1 }] }));
  const rmPart = (i) => setF((p) => ({ ...p, parts: p.parts.filter((_, x) => x !== i) }));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="facility-editor">
        <DialogHeader><DialogTitle className="font-display uppercase">{f.id ? "Edit" : "New"} Facility</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={f.name} data-testid="fac-name" onChange={(e) => up("name", e.target.value)} /></div>
          <div><Label>Tag / subtitle</Label><Input value={f.tag} onChange={(e) => up("tag", e.target.value)} /></div>
          <div><Label>Photo URL</Label><Input value={f.photo} data-testid="fac-photo" onChange={(e) => up("photo", e.target.value)} /></div>
          <div><Label>Note</Label><Textarea rows={2} value={f.note} data-testid="fac-note" onChange={(e) => up("note", e.target.value)} /></div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch checked={f.is_paid} onCheckedChange={(v) => up("is_paid", v)} data-testid="fac-paid-toggle" />
              <Label>Paid facility</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={f.fixed_duration_minutes === 60} onCheckedChange={(v) => up("fixed_duration_minutes", v ? 60 : null)} data-testid="fac-one-hour-toggle" />
              <Label>1-hour slots only</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={f.active} onCheckedChange={(v) => up("active", v)} />
              <Label>Visible</Label>
            </div>
          </div>
          {f.is_paid && (
            <div><Label>Hourly rate (€)</Label>
              <Input type="number" value={f.hourly_rate} data-testid="fac-rate" onChange={(e) => up("hourly_rate", Number(e.target.value))} />
            </div>
          )}
          <div>
            <div className="flex items-center justify-between">
              <Label>Areas / parts</Label>
              <Button size="sm" variant="outline" onClick={addPart} data-testid="add-part-btn"><Plus className="h-3.5 w-3.5" /></Button>
            </div>
            <div className="space-y-2 mt-1">
              {f.parts.map((p, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input value={p.name} placeholder="Area name" onChange={(e) => upPart(i, "name", e.target.value)} className="flex-1" />
                  <Input type="number" step="0.05" value={p.rate_multiplier} title="Rate multiplier"
                    onChange={(e) => upPart(i, "rate_multiplier", Number(e.target.value))} className="w-24" />
                  <Button size="sm" variant="ghost" onClick={() => rmPart(i)} className="text-red-600"><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(f)} data-testid="save-facility-btn" className="bg-[#15803d] text-white">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BlocksTab() {
  const [facs, setFacs] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [form, setForm] = useState({ facility_id: "", part_id: "", date: todayISO(), end_date: todayISO(), all_day: true, start_time: "18:00", duration_minutes: 60, reason: "" });

  const load = async () => {
    const f = (await api.get("/facilities")).data;
    setFacs(f);
    setBlocks((await api.get("/admin/blocks")).data);
    if (f.length && !form.facility_id) setForm((p) => ({ ...p, facility_id: f[0].id, part_id: f[0].parts[0].id }));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const facility = facs.find((x) => x.id === form.facility_id);

  const create = async () => {
    try {
      const { data } = await api.post("/admin/blocks", form);
      toast.success(`Blocked ${data.days} day(s)`);
      if (data.clashing_bookings)
        toast.warning(`${data.clashing_bookings} existing booking(s) fall inside this block. Decline them in Requests if needed.`);
      setBlocks((await api.get("/admin/blocks")).data);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    }
  };
  const remove = async (id) => { await api.delete(`/admin/blocks/${id}`); setBlocks((await api.get("/admin/blocks")).data); };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="font-display text-xl font-bold uppercase flex items-center gap-2"><Ban className="h-5 w-5 text-slate-500" /> Block time</h3>
        <p className="mt-1 text-sm text-slate-500">Close a pitch for a few hours or for weeks at a time, e.g. maintenance or county fixtures.</p>
        <div className="mt-4 space-y-3">
          <div>
            <Label>Facility</Label>
            <select data-testid="block-facility" value={form.facility_id} className="w-full h-10 rounded-lg border border-slate-200 px-3 bg-white"
              onChange={(e) => { const fac = facs.find((x) => x.id === e.target.value); setForm({ ...form, facility_id: e.target.value, part_id: fac.parts[0].id }); }}>
              {facs.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Area</Label>
            <select data-testid="block-part" value={form.part_id} className="w-full h-10 rounded-lg border border-slate-200 px-3 bg-white"
              onChange={(e) => setForm({ ...form, part_id: e.target.value })}>
              {facility?.parts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>From</Label><Input type="date" min={todayISO()} value={form.date} data-testid="block-date"
              onChange={(e) => setForm({ ...form, date: e.target.value, end_date: form.end_date < e.target.value ? e.target.value : form.end_date })} /></div>
            <div><Label>To</Label><Input type="date" min={form.date} value={form.end_date} data-testid="block-end-date" onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.all_day} onCheckedChange={(v) => setForm({ ...form, all_day: v })} data-testid="block-all-day" />
            <Label>All day</Label>
          </div>
          {!form.all_day && (
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Start</Label>
              <select value={form.start_time} className="w-full h-10 rounded-lg border border-slate-200 px-2 bg-white" onChange={(e) => setForm({ ...form, start_time: e.target.value })}>
                {START_TIMES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div><Label>Duration</Label>
              <select value={form.duration_minutes} className="w-full h-10 rounded-lg border border-slate-200 px-2 bg-white" onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}>
                {durationOptions(600).map((m) => <option key={m} value={m}>{fmtDuration(m)}</option>)}
              </select>
            </div>
          </div>
          )}
          <div><Label>Reason</Label><Input value={form.reason} data-testid="block-reason" placeholder="Maintenance, county fixture…" onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
          <Button onClick={create} data-testid="create-block-btn" className="w-full bg-[#111827] text-white">Block</Button>
        </div>
      </div>

      <div>
        <h3 className="font-display text-xl font-bold uppercase mb-3">Blocked times</h3>
        <div className="space-y-2" data-testid="blocks-list">
          {blocks.length === 0 ? <div className="text-slate-500 text-sm">None yet.</div> : blocks.map((b) => (
            <div key={b.id} className="rounded-lg border border-slate-200 bg-white p-3 flex items-center justify-between">
              <div>
                <div className="font-bold text-sm">{b.facility_name} — {b.part_name}</div>
                <div className="text-sm text-slate-500">
                  {b.start_date === b.end_date ? fmtDate(b.start_date) : `${fmtDate(b.start_date)} – ${fmtDate(b.end_date)}`}
                  {" · "}{b.all_day ? "All day" : `${b.start_time}–${b.end_time}`}{b.reason ? ` · ${b.reason}` : ""}
                </div>
              </div>
              <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(b.id)} data-testid={`delete-block-${b.id}`}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SettingsTab() {
  const [s, setS] = useState(null);
  useEffect(() => { api.get("/admin/settings").then((r) => setS(r.data)); }, []);
  if (!s) return <Loader2 className="h-6 w-6 animate-spin text-slate-400" />;

  const save = async () => {
    try {
      await api.put("/admin/settings", {
        alert_email: s.alert_email, max_duration_minutes: Number(s.max_duration_minutes), policy_note: s.policy_note,
      });
      toast.success("Settings saved");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    }
  };

  return (
    <div className="max-w-lg rounded-xl border border-slate-200 bg-white p-6">
      <h3 className="font-display text-xl font-bold uppercase flex items-center gap-2"><SettingsIcon className="h-5 w-5 text-slate-500" /> Club Settings</h3>
      <div className="mt-4 space-y-4">
        <div>
          <Label>New-request alert email</Label>
          <Input type="email" value={s.alert_email} data-testid="settings-alert-email" onChange={(e) => setS({ ...s, alert_email: e.target.value })} />
          <p className="text-xs text-slate-400 mt-1">Where new booking requests are emailed.</p>
        </div>
        <div>
          <Label>Maximum booking duration (minutes)</Label>
          <Input type="number" value={s.max_duration_minutes} data-testid="settings-max-duration" onChange={(e) => setS({ ...s, max_duration_minutes: e.target.value })} />
          <p className="text-xs text-slate-400 mt-1">Default 270 (4h 30m).</p>
        </div>
        <div>
          <Label>Booking policy note</Label>
          <Textarea rows={3} value={s.policy_note} data-testid="settings-policy" onChange={(e) => setS({ ...s, policy_note: e.target.value })} />
        </div>
        <Button onClick={save} data-testid="save-settings-btn" className="bg-[#15803d] text-white">Save settings</Button>
      </div>
    </div>
  );
}
