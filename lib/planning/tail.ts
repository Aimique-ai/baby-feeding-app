import { addMilliseconds } from "date-fns";
import type { Slot } from "./types";
import { endOfLocalDay } from "./dayBoundary";
import { buildRhythmSlots } from "./schedule";

/**
 * PRD §4.3 (locked) — build the tail starting from the next single-shifted slot.
 *
 * The first slot is anchored at `lastStart + 3h + lastShiftMin`. Subsequent
 * slots follow the same rhythm spacing as `buildRhythmSlots`, anchored from
 * the first shifted slot.
 *
 * Every slot's volume is the ideal portion: `target / feedingsPerDay`.
 *
 * Slots whose time falls past local end-of-day are dropped.
 *
 * Do NOT attempt to derive a shift from prevDayAnchor — an anchor has no
 * volumeMl, so computeShiftMinutes cannot be applied to it. Caller (pipeline)
 * must pass `lastShiftMin = 0` when `mainsToday === 0`.
 */
export function buildTail(args: {
  lastStart: Date;
  lastShiftMin: number;
  dateISO: string;
  tz: string;
  target: number;
  feedingsPerDay: number;
  alreadyToday: number;
}): Slot[] {
  const {
    lastStart,
    lastShiftMin,
    dateISO,
    tz,
    target,
    feedingsPerDay,
    alreadyToday,
  } = args;

  const idealPortion = target / feedingsPerDay;
  const dayEnd = endOfLocalDay(dateISO, tz);

  const THREE_H_MS = 3 * 60 * 60 * 1000;
  const firstSlot = addMilliseconds(
    lastStart,
    THREE_H_MS + lastShiftMin * 60 * 1000,
  );

  const slots: Slot[] = [];
  if (firstSlot.getTime() < dayEnd.getTime()) {
    slots.push({ time: firstSlot, volumeMl: idealPortion });
  }

  // Subsequent slots: anchor rhythm spacing from the first shifted slot.
  // We feed buildRhythmSlots `alreadyToday + 1` (counting the firstSlot).
  if (firstSlot.getTime() < dayEnd.getTime()) {
    const rest = buildRhythmSlots({
      lastStart: firstSlot,
      dateISO,
      tz,
      feedingsPerDay,
      alreadyToday: alreadyToday + 1,
    });
    for (const t of rest) {
      if (t.getTime() < dayEnd.getTime()) {
        slots.push({ time: t, volumeMl: idealPortion });
      }
    }
  }

  return slots;
}
