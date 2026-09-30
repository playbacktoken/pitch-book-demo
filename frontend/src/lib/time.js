export function toMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function fromMinutes(total) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function endTime(start, duration) {
  return fromMinutes(toMinutes(start) + duration);
}

export function overlaps(s1, e1, s2, e2) {
  return toMinutes(s1) < toMinutes(e2) && toMinutes(s2) < toMinutes(e1);
}

// Start times 07:00 -> 21:45 in 15-min steps
export const START_TIMES = (() => {
  const out = [];
  for (let m = 7 * 60; m <= 21 * 60 + 45; m += 15) out.push(fromMinutes(m));
  return out;
})();

// Durations 1h .. max in 15-min steps
export function durationOptions(maxMinutes) {
  const out = [];
  for (let m = 60; m <= maxMinutes; m += 15) out.push(m);
  return out;
}

export function fmtDuration(m) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm === 0 ? `${h}h` : `${h}h ${mm}m`;
}

export function fmtMoney(n) {
  return `€${Number(n).toFixed(2)}`;
}

export const WEEKDAYS = [
  { i: 0, label: "Mon" },
  { i: 1, label: "Tue" },
  { i: 2, label: "Wed" },
  { i: 3, label: "Thu" },
  { i: 4, label: "Fri" },
  { i: 5, label: "Sat" },
  { i: 6, label: "Sun" },
];

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDaysISO(iso, days) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IE", { weekday: "short", day: "numeric", month: "short" });
}
