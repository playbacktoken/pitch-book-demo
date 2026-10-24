import React from "react";
import { CheckCircle2, Clock, XCircle, Ban } from "lucide-react";

const MAP = {
  requested: { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE", label: "Requested", Icon: Clock },
  approved: { bg: "#ECFDF5", text: "#065F46", border: "#6EE7B7", label: "Approved", Icon: CheckCircle2 },
  declined: { bg: "#FEF2F2", text: "#B91C1C", border: "#FECACA", label: "Declined", Icon: XCircle },
  blocked: { bg: "#F3F4F6", text: "#4B5563", border: "#E5E7EB", label: "Blocked", Icon: Ban },
  cancelled: { bg: "#F3F4F6", text: "#4B5563", border: "#E5E7EB", label: "Removed", Icon: Ban },
};

export function StatusBadge({ status, className = "" }) {
  const s = MAP[status] || MAP.requested;
  const { Icon } = s;
  return (
    <span
      data-testid={`status-badge-${status}`}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${className}`}
      style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}
    >
      <Icon className="h-3 w-3" /> {s.label}
    </span>
  );
}

export function PriceBadge({ isPaid, className = "" }) {
  if (!isPaid) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${className}`}
      style={{ background: "#FEF3C7", color: "#B45309", border: "1px solid #FDE68A" }}
    >
      Paid Slot
    </span>
  );
}

export function PayBadge({ status }) {
  if (status === "paid")
    return <span className="text-xs font-bold text-[#047857]">● Paid</span>;
  const other = {
    due: ["Awaiting payment", "#B45309"],
    partial: ["Part paid", "#B45309"],
    not_due: ["Pay after approval", "#64748B"],
    expired: ["Not paid", "#B91C1C"],
    waived: ["No payment (club)", "#047857"],
  }[status];
  if (other)
    return <span className="text-xs font-bold" style={{ color: other[1] }} data-testid={`pay-badge-${status}`}>● {other[0]}</span>;
  return null;
}
