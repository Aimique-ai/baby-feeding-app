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
 * Formula energy density — engine parameter (PRD §5.1).
 */
export type FormulaDensity = {
  kcalPer100ml: number;
  proteinGPer100kcal: number | null;
};

/** Observation flag severity, derived from the computation result. */
export type TargetFlagSeverity = "info" | "warning";

/** Observation flag — discriminated union on `code` (PRD §5.1). */
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
  /** AAP sanity-check on volume (weight × 165). A second number, easy to hide. */
  aapMl: number;
  protein: {
    gPerDay: number;
    gPerKgDay: number;
  } | null;
  flags: TargetFlag[];
};

export type NeonatalTarget = {
  mode: "neonatal";
  /** Flat range of 30–60 ml per feeding. */
  perFeedMlRange: [number, number];
  feedCount: number;
  feedCountRange: [number, number];
  // Union narrowed: a neonatal result (0–13d) allows only the 0–7d zone flag —
  // the compiler forbids energy-mode flags (aap/ml_per_kg/density) and the
  // 40×weight flag (which lives in the actual-feedings layer, zone >14d).
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
