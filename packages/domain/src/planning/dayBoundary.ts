import { fromZonedTime, toZonedTime, format } from "date-fns-tz";
import { differenceInCalendarDays } from "date-fns";

export function startOfLocalDay(dateISO: string, tz: string): Date {
  return fromZonedTime(`${dateISO}T00:00:00`, tz);
}

export function endOfLocalDay(dateISO: string, tz: string): Date {
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

export function isBirthday(
  birthDate: Date,
  dateISO: string,
  tz: string,
): boolean {
  return localDateISO(birthDate, tz) === dateISO;
}

export function dayOfLife(birthDate: Date, today: Date, tz: string): number {
  const birthLocal = toZonedTime(birthDate, tz);
  const todayLocal = toZonedTime(today, tz);
  return differenceInCalendarDays(todayLocal, birthLocal);
}
