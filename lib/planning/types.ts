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
 * Раскладка строится по ритм-ориентированной модели (концепция §5):
 * N слотов в позициях anchor + step·i, где step = H_остатка/(N+1).
 * Все слоты имеют одинаковый объём (clamp-порция); сумма порций
 * НЕ обязана точно совпадать с remainingMl — ритм первичен.
 */
export type Slot = { time: Date; volumeMl: number };

/**
 * Причина выбранного числа слотов N — диагностика.
 *   "in-corridor" — найден N, при котором step ∈ [интервал_мин, интервал_макс]
 *   "squeezed"    — коридорного N нет; берём densest N со step ≤ интервал_макс:
 *                   n = max(1, ceil(H/интервал_макс − 1)) — покрывает и малый
 *                   горизонт, и случай узкого коридора с дискретным разрывом
 *   "empty"       — N = 0: горизонт слишком мал для хотя бы одного слота
 */
export type SlotCountReason = "in-corridor" | "squeezed" | "empty";

export type SlotCountSolution = {
  n: number;
  stepHours: number;
  reason: SlotCountReason;
};

/**
 * План остатка дня — результат `planRemainder`.
 * `slots` содержит только СЕГОДНЯШНИЕ плановые слоты (длина n).
 * `tomorrowSlot` — (N+1)-й узел ритма, если он календарно завтра (UI §8).
 */
export type RemainderPlan = {
  n: number;                 // число СЕГОДНЯШНИХ плановых слотов (= slots.length)
  reason: SlotCountReason;
  stepHours: number;         // H_остатка / (n+1); 0 при n = 0
  horizonHours: number;      // H_остатка — диагностика
  slotVolumeMl: number;      // clamp-порция; 0 при n = 0
  slots: Slot[];             // СЕГОДНЯШНИЕ плановые слоты (длина n)
  tomorrowSlot: Slot | null; // (N+1)-й узел, ТОЛЬКО если он календарно завтра
};
