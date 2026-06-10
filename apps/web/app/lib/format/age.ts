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
    const days = differenceInCalendarDays(view, birth) + 1;
    return formatDuration({ days }, { locale: ru, format: ["days"] });
  }

  const days = differenceInCalendarDays(view, addMonths(birth, months)) + 1;
  return formatDuration(
    { months, days },
    { locale: ru, format: ["months", "days"] },
  );
}
