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
};

export type Weight = {
  date: Date;
  weightGrams: number;
};

export type Baby = {
  birthDate: Date;
  birthWeightGrams: number;
};

/**
 * Энергоплотность смеси — параметр движка (PRD §5.1).
 */
export type FormulaDensity = {
  kcalPer100ml: number;
  proteinGPer100kcal: number | null;
};

/** Флаг наблюдения по результату расчёта (PRD §5.1). */
export type TargetFlag = { code: "ml_per_kg_high"; valueMlKg: number };

export type FeedingTarget = {
  dailyMl: number;
  dailyMlRange: [number, number];
  mlPerFeed: number;
  mlPerFeedRange: [number, number];
  feedCount: number;
  feedCountRange: [number, number];
  dailyKcal: number;
  mode: "neonatal" | "energy";
  protein: {
    gPerDay: number;
    gPerKgDay: number;
  } | null;
  flags: TargetFlag[];
};

export type Slot = { time: Date; volumeMl: number };

export type SlotCountReason = "in-corridor" | "squeezed" | "empty";

export type SlotCountSolution = {
  n: number;
  stepHours: number;
  reason: SlotCountReason;
};

export type RemainderPlan = {
  n: number;
  reason: SlotCountReason;
  stepHours: number;
  horizonHours: number;
  slotVolumeMl: number;
  slots: Slot[];
  tomorrowSlot: Slot | null;
};
