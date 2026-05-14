import { startOfLocalDay } from "./dayBoundary";
import type { Feeding, Slot } from "./types";
import { buildTail } from "./tail";
import { computeShiftMinutes } from "./shift";

export type PipelineResult = {
  consumed: number;
  lastStart: Date;
  tail: Slot[];
};

/**
 * PRD §4.3 (locked) — single next-slot shift algorithm.
 *
 * One pass over sorted facts:
 *  - Historical top-up rows (isTopUp:true) are summed into `consumed` but do
 *    NOT advance `lastStart`, do NOT increment `mainsToday`, and do NOT
 *    contribute to the shift computation.
 *  - Each main feeding advances `lastStart` and, if its `startAt >= dayStart`,
 *    increments `mainsToday`. We capture `lastShiftMin` from the last main
 *    using `computeShiftMinutes` with `prevStartAt = previous main's startAt`.
 *
 * After the loop:
 *  - If `mainsToday === 0`, set `lastShiftMin = 0` (no fact volume to compute
 *    deviation from — `prevDayAnchor` has no volume).
 *  - Tail is built from `lastStart + 3h + lastShiftMin`.
 */
export function runPipeline(args: {
  facts: Feeding[];
  target: number;
  startOfDay: Date;
  dateISO: string;
  tz: string;
  feedingsPerDay: number;
  /**
   * startAt последнего кормления любого типа до 00:00 локального D.
   */
  prevDayAnchor?: Date | null;
}): PipelineResult {
  const {
    facts,
    target,
    startOfDay,
    dateISO,
    tz,
    feedingsPerDay,
    prevDayAnchor,
  } = args;

  const sorted = [...facts].sort(
    (a, b) => a.startAt.getTime() - b.startAt.getTime(),
  );

  const dayStart = startOfLocalDay(dateISO, tz);
  const idealPortion = target / feedingsPerDay;

  let consumed = 0;
  let lastStart: Date = prevDayAnchor ?? startOfDay;
  let mainsToday = 0;
  let lastShiftMin = 0;
  // Tracks the prev main's startAt, used as `prevStartAt` for the next main's
  // shift computation. Initially seeded from prevDayAnchor when present.
  let prevMainStart: Date | null = prevDayAnchor ?? null;

  for (const f of sorted) {
    const v = f.volumeMl ?? 0;

    if (f.isTopUp) {
      // Historical top-up record. Sum, but do not advance lastStart or counters.
      consumed += v;
      continue;
    }

    // Main feeding.
    consumed += v;

    // Compute shift using the *previous* main's startAt as prev.
    if (prevMainStart == null) {
      // No prior main exists at all (no anchor, no earlier facts today):
      // shift formula has no meaningful `prev`. Leave shift as 0.
      lastShiftMin = 0;
    } else {
      lastShiftMin = computeShiftMinutes({
        factVolumeMl: v,
        idealPortion,
        factStartAt: f.startAt,
        prevStartAt: prevMainStart,
      });
    }

    prevMainStart = f.startAt;
    lastStart = f.startAt;
    if (f.startAt.getTime() >= dayStart.getTime()) {
      mainsToday += 1;
    }
  }

  // No main facts processed today → no fact volume to base shift on.
  if (mainsToday === 0) {
    lastShiftMin = 0;
  }

  const tail = buildTail({
    lastStart,
    lastShiftMin,
    dateISO,
    tz,
    target,
    feedingsPerDay,
    alreadyToday: mainsToday,
  });

  return { consumed, lastStart, tail };
}
