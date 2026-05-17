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
 * Энергоплотность смеси — параметр движка (PRD §5.1). Никогда не поле Baby:
 * lib/planning остаётся чистым от понятия сущности «смесь».
 */
export type FormulaDensity = {
  kcalPer100ml: number; // дефолт 67
  proteinGPer100kcal: number | null;
};

/** Флаг наблюдения по результату расчёта (PRD §5.1). */
export type TargetFlag = { code: "ml_per_kg_high"; valueMlKg: number };

/**
 * Результат computeFeedingGuidance — только для UX DayView (PRD §5.1).
 * Серверные потребители используют computeTarget (возвращает number).
 */
export type FeedingTarget = {
  dailyMl: number; // округл. до 10, центр диапазона
  dailyMlRange: [number, number]; // ± практический коридор
  mlPerFeed: number; // округл. до 5
  mlPerFeedRange: [number, number];
  feedCount: number; // рекомендуемый центр
  feedCountRange: [number, number];
  dailyKcal: number;
  mode: "neonatal" | "energy";
  protein: {
    gPerDay: number;
    gPerKgDay: number;
  } | null;
  flags: TargetFlag[];
};

/**
 * Слот плана. Единая форма: момент времени + предписанный объём.
 * Объём всегда равен idealPortion = target / feedingsPerDay.
 * Время может быть сдвинуто на ±0..30 минут относительно (lastStart + 3h)
 * единственного next-slot shift (см. `shift.ts`).
 */
export type Slot = { time: Date; volumeMl: number };
