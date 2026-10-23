import React, { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Crest } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { fmtMoney, fmtDate } from "@/lib/time";
import { CreditCard, Loader2, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";

const fmtDue = (iso) =>
  new Date(iso).toLocaleString("en-IE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function PayPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const t = params.get("t") || "";
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    api.get(`/pay/${id}`, { params: { t } }).then((r) => setData(r.data)).catch(() => setError(true));
  }, [id, t]);

  const pay = async (mode) => {
    setBusy(mode);
    try {
      const { data: res } = await api.post(`/pay/${id}/checkout`, { t, mode, origin_url: window.location.origin });
      window.location.href = res.checkout_url;
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
      setBusy("");
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f17] text-white flex items-center justify-center px-4 py-10">
      <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 p-8 animate-rise" data-testid="pay-page">
        <div className="flex justify-center mb-5"><Crest className="h-20 w-20" /></div>
        {!data && !error && <Loader2 className="h-10 w-10 mx-auto animate-spin text-emerald-400" />}
        {error && <Message Icon={XCircle} title="Link not found" text="This payment link is not valid. Please check the email from the club." />}
        {data && <PayBody data={data} pay={pay} busy={busy} />}
        <div className="text-center">
          <Link to="/"><Button variant="ghost" className="mt-6 text-slate-300 hover:text-white hover:bg-white/10"><ArrowLeft className="h-4 w-4 mr-1" /> Back to bookings</Button></Link>
        </div>
      </div>
    </div>
  );
}

function Message({ Icon, title, text }) {
  return (
    <div className="text-center">
      <Icon className="h-12 w-12 mx-auto text-emerald-400" />
      <h1 className="mt-4 font-display text-2xl font-extrabold uppercase">{title}</h1>
      <p className="mt-2 text-slate-300 text-sm">{text}</p>
    </div>
  );
}

function PayBody({ data, pay, busy }) {
  const n = data.unpaid.length;
  if (data.status === "cancelled")
    return <Message Icon={XCircle} title="Booking removed" text={`Booking ${data.reference} was removed because it was not paid in time.`} />;
  if (n === 0)
    return <Message Icon={CheckCircle2} title="All paid" text={`Booking ${data.reference} is fully paid. Thank you.`} />;
  const next = data.unpaid[0];
  return (
    <div>
      <h1 className="text-center font-display text-2xl font-extrabold uppercase">Pay for your booking</h1>
      <p className="mt-1 text-center text-sm text-slate-400">{data.reference} · {data.facility_name}, {data.part_name}</p>
      <div className="mt-5 rounded-xl bg-white/5 border border-white/10 divide-y divide-white/10" data-testid="pay-sessions">
        {data.unpaid.map((s) => (
          <div key={s.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
            <span>{fmtDate(s.date)} · {s.start_time}–{s.end_time}</span>
            <span className="font-mono-nums font-bold">{fmtMoney(data.per_session_amount)}</span>
          </div>
        ))}
      </div>
      {next.pay_due_at && (
        <p className="mt-3 text-xs text-amber-300" data-testid="pay-deadline">
          Pay by {fmtDue(next.pay_due_at)} or the booking on {fmtDate(next.date)} will be removed.
        </p>
      )}
      <div className="mt-5 space-y-2">
        <Button onClick={() => pay("next")} disabled={!!busy} data-testid="pay-next-btn"
          className="w-full h-11 bg-[#15803d] hover:bg-[#166534] text-white font-bold">
          {busy === "next" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CreditCard className="h-4 w-4 mr-2" />}
          Pay {n > 1 ? `for ${fmtDate(next.date)}` : ""} {fmtMoney(data.per_session_amount)}
        </Button>
        {n > 1 && (
          <Button onClick={() => pay("all")} disabled={!!busy} data-testid="pay-all-btn"
            className="w-full h-11 bg-white text-[#111827] hover:bg-slate-200 font-bold">
            {busy === "all" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Pay all {n} weeks {fmtMoney(data.per_session_amount * n)}
          </Button>
        )}
      </div>
      {n > 1 && (
        <p className="mt-3 text-xs text-slate-400">
          If you pay week by week, we will email you a payment link the day before each booking. Each one must be paid within 6 hours.
        </p>
      )}
    </div>
  );
}
