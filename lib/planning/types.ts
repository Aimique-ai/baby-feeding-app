/**
 * Pure planning types per PRD §3 / §4.
 *
 * Times that cross a day boundary depend on a timezone string (`tz`); times
 * within a single absolute moment do not. Keeping `tz` as a parameter rather
 * than reading from a global makes every function deterministic and testable.
 */

export type Feeding = {
  _id: string;
  startAt: Date;
  endAt: Date | null;
  volumeMl: number | null;
  isTopUp: boolean;
  parentFeedingId: string | null;
};

export type Weight = {
  date: Date;
  weightGrams: number;
};

export type Baby = {
  birthDate: Date;
  birthWeightGrams: number;
  feedingsPerDay: number;
};

/**
 * Слот плана. Единая форма: момент времени + предписанный объём.
 * Объём всегда равен idealPortion = target / feedingsPerDay.
 * Время может быть сдвинуто на ±0..30 минут относительно (lastStart + 3h)
 * единственного next-slot shift (см. `shift.ts`).
 */
export type Slot = { time: Date; volumeMl: number };
