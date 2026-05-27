import { format, toZonedTime } from "date-fns-tz";
import { ru } from "date-fns/locale/ru";

export function fmtHm(d: Date, tz: string): string {
  return format(toZonedTime(d, tz), "HH:mm", { timeZone: tz });
}

export function fmtDateLong(d: Date, tz: string): string {
  return format(toZonedTime(d, tz), "d MMMM yyyy", {
    timeZone: tz,
    locale: ru,
  });
}
