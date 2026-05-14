import { addHours } from "date-fns";
import type { Feeding, Slot } from "./types";
import { startOfLocalDay, endOfLocalDay } from "./dayBoundary";

/**
 * PRD §4.2 — стартовый план дня D.
 *   anchor = startAt последнего кормления с startAt < 00:00 локального D
 *            или 00:00 D, если кормлений нет
 *   слоты:  t = anchor + 3h, шаг 3h, пока t < 24:00 D
 *   portion = target / K_start    (K_start ∈ [7, 8] при шаге 3h и сутках 24h)
 *
 * Все слоты получают одинаковую portion. Не сопоставляется с фактом.
 */
export function computeStartPlan(
  dateISO: string,
  target: number,
  prevFeedingsBeforeDay: Feeding[],
  tz: string,
): Slot[] {
  const dayStart = startOfLocalDay(dateISO, tz);
  const dayEnd = endOfLocalDay(dateISO, tz);

  const before = prevFeedingsBeforeDay.filter(
    (f) => f.startAt.getTime() < dayStart.getTime(),
  );
  const lastBefore = before.length
    ? before.reduce((a, b) =>
        b.startAt.getTime() > a.startAt.getTime() ? b : a,
      )
    : null;

  const anchor = lastBefore?.startAt ?? dayStart;
  const slots: Date[] = [];
  let t = addHours(anchor, 3);
  while (t.getTime() < dayEnd.getTime()) {
    slots.push(t);
    t = addHours(t, 3);
  }
  if (slots.length === 0) return [];
  const portion = target / slots.length;
  return slots.map((time) => ({
    time,
    volumeMl: portion,
  }));
}
