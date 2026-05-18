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
 * Раскладка строится `placeSlots` (см. `remainderPlan.ts`): K слотов в
 * позициях anchor + step·i, где step = remainingHours/(K+1). Объёмы слотов
 * дают точную сумму = remainingMl при гарантии неотрицательности.
 */
export type Slot = { time: Date; volumeMl: number };

/**
 * Причина выбранного K — диагностика, отражает только состояние (a)∩(b).
 *   "intersect"     — найден валидный K внутри жёсткого пересечения (a)∩(b)
 *   "clamped-high"  — недобор: (a) целиком выше (b), K клампится к верхней границе (b)
 *   "clamped-low"   — переедание: (a) целиком ниже (b), K клампится к нижней границе (b)
 *   "best-effort"   — окно (a) вырождено внутри (b): идеального K нет, выбран K из
 *                     (b) с порцией минимально далёкой от нормы (a) — компромисс
 */
export type FeedCountReason =
  | "intersect"
  | "clamped-high"
  | "clamped-low"
  | "best-effort";

export type FeedCountSolution = {
  k: number; // выбранное число оставшихся слотов, целое >= 0
  reason: FeedCountReason;
};

/**
 * План остатка дня — результат `planRemainder`.
 * Источник истины по объёмам — массив `slots`; `slotVolumeMl` справочный.
 */
export type RemainderPlan = {
  k: number;
  reason: FeedCountReason;
  slotVolumeMl: number; // round5(remainingMl/K) — номинал; 0 если K=0
  stepHours: number; // stepHoursFor(K, remainingHours); 0 если K=0
  slots: Slot[]; // фактическая раскладка с точной суммой объёмов
};
