// The kitchen lives in Bucharest: "today" and display times always use that
// zone, on the server and in the browser, so they agree (and hydrate cleanly).

export const KITCHEN_TZ = "Europe/Bucharest";

const ymd = new Intl.DateTimeFormat("en-CA", {
  timeZone: KITCHEN_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** YYYY-MM-DD of `date` in the kitchen's time zone. */
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

/** The instant the kitchen's current day started (local midnight), as a Date. */
export function kitchenDayStart(date: Date = new Date()): Date {
  const [y, m, d] = kitchenDate(date).split("-").map(Number);
  const utcMidnight = Date.UTC(y, m - 1, d);
  // Offset measured near local midnight handles DST switch days correctly.
  return new Date(utcMidnight - offsetMinutes(new Date(utcMidnight)) * 60_000);
}

/** Today's date at HH:MM in the kitchen's time zone, as a Date. */
export function kitchenTimeToday(hhmm: string, now: Date = new Date()): Date | null {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  const start = kitchenDayStart(now);
  const local = new Date(start.getTime() + (Number(m[1]) * 60 + Number(m[2])) * 60_000);
  // Correct for a DST change between midnight and that time.
  const drift = offsetMinutes(local) - offsetMinutes(start);
  return new Date(local.getTime() - drift * 60_000);
}

/** "HH:MM" of an instant in the kitchen's time zone (for <input type="time">). */
export function kitchenHHMM(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: KITCHEN_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

/** "mm:ss" or "h:mm:ss" for a duration in milliseconds (never negative). */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
