import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { Crest } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, ArrowLeft } from "lucide-react";

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-[#0b0f17] text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/5 p-8 text-center animate-rise">
        <div className="flex justify-center mb-5">
          <div className="rounded-xl bg-[#111827] p-2"><Crest className="h-10 w-10" /></div>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PaymentSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const [state, setState] = useState("checking"); // checking | paid | error
  const [reference, setReference] = useState("");

  useEffect(() => {
    let tries = 0;
    let timer;
    const poll = async () => {
      tries += 1;
      try {
        const { data } = await api.get(`/payments/status/${sessionId}`);
        setReference(data.reference || "");
        if (data.payment_status === "paid") {
          setState("paid");
          return;
        }
        if (["expired", "failed"].includes(data.payment_status) || tries > 8) {
          setState("error");
          return;
        }
      } catch {
        if (tries > 8) {
          setState("error");
          return;
        }
      }
      timer = setTimeout(poll, 1800);
    };
    if (sessionId) poll();
    else setState("error");
    return () => clearTimeout(timer);
  }, [sessionId]);

  return (
    <Shell>
      {state === "checking" && (
        <>
          <Loader2 className="h-12 w-12 mx-auto animate-spin text-emerald-400" />
          <h1 className="mt-4 font-display text-2xl font-extrabold uppercase">Confirming payment…</h1>
          <p className="mt-2 text-slate-400 text-sm">Please wait while we check your payment.</p>
        </>
      )}
      {state === "paid" && (
        <>
          <CheckCircle2 className="h-14 w-14 mx-auto text-emerald-400" />
          <h1 className="mt-4 font-display text-2xl font-extrabold uppercase" data-testid="payment-success">
            Payment Received
          </h1>
          <p className="mt-2 text-slate-300 text-sm">
            Booking request <strong className="font-mono-nums">{reference}</strong> has been paid and is waiting
            for club approval. A confirmation has been sent to your email.
          </p>
          <Link to="/">
            <Button className="mt-6 bg-[#15803d] hover:bg-[#166534] text-white" data-testid="back-home-btn">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to bookings
            </Button>
          </Link>
        </>
      )}
      {state === "error" && (
        <>
          <XCircle className="h-14 w-14 mx-auto text-amber-400" />
          <h1 className="mt-4 font-display text-2xl font-extrabold uppercase">Still Processing</h1>
          <p className="mt-2 text-slate-300 text-sm">
            We could not confirm your payment yet. If you paid, your booking will update shortly.
            You can check it using your booking reference on the home page.
          </p>
          <Link to="/">
            <Button className="mt-6 bg-white/10 border border-white/20 text-white hover:bg-white/20">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back home
            </Button>
          </Link>
        </>
      )}
    </Shell>
  );
}

export function PaymentCancel() {
  return (
    <Shell>
      <XCircle className="h-14 w-14 mx-auto text-slate-400" />
      <h1 className="mt-4 font-display text-2xl font-extrabold uppercase">Payment Cancelled</h1>
      <p className="mt-2 text-slate-300 text-sm">
        You have not been charged and the booking was not made. You can book again at any time.
      </p>
      <Link to="/">
        <Button className="mt-6 bg-[#15803d] hover:bg-[#166534] text-white">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to bookings
        </Button>
      </Link>
    </Shell>
  );
}
