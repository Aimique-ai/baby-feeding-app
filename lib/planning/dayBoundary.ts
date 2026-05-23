import { fromZonedTime, toZonedTime, format } from "date-fns-tz";
import { differenceInCalendarDays } from "date-fns";

/**
 * Calendar-day helpers that respect IANA timezones, isolated so the rest of
 * lib/planning never touches `Date` boundaries directly.
 */

export function startOfLocalDay(dateISO: string, tz: string): Date {
  return fromZonedTime(`${dateISO}T00:00:00`, tz);
}

export function endOfLocalDay(dateISO: string, tz: string): Date {
  // [00:00 next day) — exclusive upper bound of the local day.
  const [y, m, d] = dateISO.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const nextISO = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
  return fromZonedTime(`${nextISO}T00:00:00`, tz);
}

export function localDateISO(d: Date, tz: string): string {
  return format(toZonedTime(d, tz), "yyyy-MM-dd", { timeZone: tz });
}

export function addDaysISO(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  const yy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(next.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * True если календарный день dateISO совпадает с календарным днём birthDate в tz.
 * Нужен для якоря суток (концепция §4). Чистый, без process timezone.
 */
export function isBirthday(birthDate: Date, dateISO: string, tz: string): boolean {
  return localDateISO(birthDate, tz) === dateISO;
}

/**
 * Day-of-life per PRD §2.2: floor((today − birthDate) / 24h) + 1, by calendar
 * days in the local TZ. Day 1 is the day of birth.
 */
export function dayOfLife(birthDate: Date, today: Date, tz: string): number {
  const birthLocal = toZonedTime(birthDate, tz);
  const todayLocal = toZonedTime(today, tz);
  return differenceInCalendarDays(todayLocal, birthLocal) + 1;
}
