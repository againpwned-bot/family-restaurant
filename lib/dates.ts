export const KITCHEN_TZ = "Europe/Bucharest";

const ymd = new Intl.DateTimeFormat("en-CA", {
  timeZone: KITCHEN_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function kitchenDate(date: Date = new Date()): string {
  return ymd.format(date);
}

function offsetMinutes(at: Date): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: KITCHEN_TZ, timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value;
  const m = name?.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

export function kitchenDayStart(date: Date = new Date()): Date {
  const [y, m, d] = kitchenDate(date).split("-").map(Number);
  const utcMidnight = Date.UTC(y, m - 1, d);
  return new Date(utcMidnight - offsetMinutes(new Date(utcMidnight)) * 60_000);
}

export function kitchenTimeToday(hhmm: string, now: Date = new Date()): Date | null {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  const start = kitchenDayStart(now);
  const local = new Date(start.getTime() + (Number(m[1]) * 60 + Number(m[2])) * 60_000);
  const drift = offsetMinutes(local) - offsetMinutes(start);
  return new Date(local.getTime() - drift * 60_000);
}

export function kitchenHHMM(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: KITCHEN_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// Calendar arithmetic on "YYYY-MM-DD" kitchen days.
export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function weekStart(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(day, -((weekday + 6) % 7));
}

export function dayAsDate(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

export const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
