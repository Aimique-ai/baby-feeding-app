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

/** Уровень флага наблюдения по результату расчёта. */
export type TargetFlagSeverity = "info" | "warning";

/** Флаг наблюдения — дискриминированный союз по `code` (PRD §5.1). */
export type TargetFlag =
  | { code: "ml_per_kg_high"; severity: "warning"; valueMlKg: number }
  | { code: "ml_per_kg_low"; severity: "info"; valueMlKg: number }
  | {
      code: "aap_soft_cap_exceeded";
      severity: "warning";
      source: "AAP";
      valueMl: number;
    }
  | {
      code: "density_out_of_codex_range";
      severity: "warning";
      kcalPer100ml: number;
    }
  | {
      code: "large_single_feed_early_newborn";
      severity: "info";
      perFeedMl: number;
      weightKg: number;
    }
  | {
      code: "single_feed_unusually_large_for_weight";
      severity: "info";
      perFeedMl: number;
      weightKg: number;
    };

export type EnergyTarget = {
  mode: "energy";
  dailyMl: number;
  dailyMlRange: [number, number];
  mlPerFeed: number;
  mlPerFeedRange: [number, number];
  feedCount: number;
  feedCountRange: [number, number];
  dailyKcal: number;
  /** AAP sanity-check по объёму (weight × 165). Второе число, легко скрыть. */
  aapMl: number;
  protein: {
    gPerDay: number;
    gPerKgDay: number;
  } | null;
  flags: TargetFlag[];
};

export type NeonatalTarget = {
  mode: "neonatal";
  /** Плоский диапазон 30–60 мл на кормление. */
  perFeedMlRange: [number, number];
  feedCount: number;
  feedCountRange: [number, number];
  // Союз сужен: в неонатальном результате (0–13д) допустим только флаг зоны
  // 0–7д — компилятор запрещает энергорежимные флаги (aap/ml_per_kg/density)
  // и флаг 40×вес (он живёт в слое фактических кормлений, зона >14д).
  flags: Extract<TargetFlag, { code: "large_single_feed_early_newborn" }>[];
};

export type FeedingTarget = EnergyTarget | NeonatalTarget;

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
