import { startOfLocalDay } from "./dayBoundary";
import { planRemainder } from "./remainderPlan";
import type { Feeding, RemainderPlan } from "./types";

export type PipelineResult = {
  consumed: number;
  mainsToday: number;
  anchor: Date; // время последнего основного кормления / fallback
  plan: RemainderPlan;
};

/**
 * feed-plan-rewrite §3.5 — единый проход по фактам + один вызов planRemainder.
 *
 * Один проход по отсортированным фактам:
 *  - consumed += volumeMl ?? 0 для ВСЕХ записей (включая isTopUp);
 *  - isTopUp → НЕ инкрементит mainsToday, НЕ двигает anchor;
 *  - основное кормление → mainsToday += 1 если startAt >= dayStart;
 *    anchor = startAt;
 *  - если основных сегодня нет → anchor = prevMainAnchor ?? startOfDay.
 *
 * `prevMainAnchor` — последнее ОСНОВНОЕ кормление до startOfDay (докорм
 * прошлого дня не может стать якорем — Principle #6).
 */
export function runPipeline(args: {
  facts: Feeding[];
  target: number;
  startOfDay: Date;
  dateISO: string;
  tz: string;
  range: [number, number];
  prevMainAnchor?: Date | null;
}): PipelineResult {
  const { facts, target, startOfDay, dateISO, tz, range, prevMainAnchor } =
    args;

  const sorted = [...facts].sort(
    (a, b) => a.startAt.getTime() - b.startAt.getTime(),
  );

  const dayStart = startOfLocalDay(dateISO, tz);

  let consumed = 0;
  let mainsToday = 0;
  let lastMainStart: Date | null = null;

  for (const f of sorted) {
    consumed += f.volumeMl ?? 0;
    if (f.isTopUp) continue;

    // Основное кормление.
    lastMainStart = f.startAt;
    if (f.startAt.getTime() >= dayStart.getTime()) {
      mainsToday += 1;
    }
  }

  const anchor =
    lastMainStart ?? prevMainAnchor ?? startOfDay;

  const plan = planRemainder({
    target,
    consumed,
    mainsToday,
    anchor,
    dateISO,
    tz,
    range,
  });

  return { consumed, mainsToday, anchor, plan };
}
