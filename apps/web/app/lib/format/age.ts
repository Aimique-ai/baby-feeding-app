import {
  addMonths,
  differenceInCalendarDays,
  differenceInMonths,
  formatDuration,
} from "date-fns";
import { ru } from "date-fns/locale/ru";
import { toZonedTime } from "date-fns-tz";

export function fmtAge(birthDate: Date, viewDay: Date, tz: string): string {
  const birth = toZonedTime(birthDate, tz);
  const view = toZonedTime(viewDay, tz);

  const months = differenceInMonths(view, birth);

  if (months < 1) {
    const days = differenceInCalendarDays(view, birth);
    if (days === 0) return "0 дней";
    return formatDuration({ days }, { locale: ru, format: ["days"] });
  }

  const days = differenceInCalendarDays(view, addMonths(birth, months));
  return formatDuration(
    { months, days },
    { locale: ru, format: ["months", "days"] },
  );
}
