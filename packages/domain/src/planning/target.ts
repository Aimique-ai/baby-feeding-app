import type {
  Baby,
  EnergyTarget,
  FeedingTarget,
  FormulaDensity,
  NeonatalTarget,
  TargetFlag,
  Weight,
} from "./types";
import { dayOfLife, startOfLocalDay } from "./dayBoundary";
import { ageMonthsFromDays, targetKcalPerKg } from "./energyCurve";
import { neonatalPerFeedRange } from "./neonatal";
import { feedCountRange } from "./feedCount";
import { ceil10, floor10, round5, round10 } from "../math/round";

export const DEFAULT_FORMULA_DENSITY: FormulaDensity = {
  kcalPer100ml: 67,
  proteinGPer100kcal: null,
};

const NEONATAL_MAX_AGE_DAYS = 14;
const ML_PER_KG_HIGH_THRESHOLD = 200;
const ML_PER_KG_LOW_THRESHOLD = 120;
// Single-feed sanity check (§7.5, heuristic — NOT a clinical cap).
// 0–7 days: per-feed volume > 20 ml/kg → info (caution, Front Pediatr 2023).
const EARLY_NEWBORN_MAX_AGE_DAYS = 7;
const EARLY_NEWBORN_PER_FEED_ML_PER_KG = 20;
// FAO/WHO/UNU 2004: CV(TEE/kg/day) ≈ 15% — ±1 SD of a healthy population.
// https://www.fao.org/4/y5686e/y5686e05.htm
const DAILY_ML_RANGE_FRACTION = 0.15;
// AAP: practical upper ceiling for daily formula volume.
// Used ONLY as a soft-flag threshold — NOT as a range clamp.
const AAP_SOFT_CAP_ML = 960;
// AAP volume sanity-check: weight_kg × 165 ml.
const AAP_ML_PER_KG = 165;
// Codex: acceptable energy density of ready-to-feed formula is 60–70 kcal/100 ml.
const CODEX_KCAL_MIN = 60;
const CODEX_KCAL_MAX = 70;

function safeKcalPer100ml(kcalPer100ml: number): number {
  if (Number.isFinite(kcalPer100ml) && kcalPer100ml > 0) {
    return kcalPer100ml;
  }
  return DEFAULT_FORMULA_DENSITY.kcalPer100ml;
}

type DayContext = {
  ageDays: number;
  weightKg: number;
  mode: "neonatal" | "energy";
};

function resolveDayContext(
  dateISO: string,
  baby: Baby,
  weights: Weight[],
  tz: string,
): DayContext {
  const dayStart = startOfLocalDay(dateISO, tz);
  const n = dayOfLife(baby.birthDate, dayStart, tz);
  const ageDays = n - 1;

  const eligible = weights.filter((w) => w.date.getTime() <= dayStart.getTime());
  const latestWeightGrams =
    eligible.length === 0
      ? baby.birthWeightGrams
      : eligible.reduce((acc, w) =>
          w.date.getTime() > acc.date.getTime() ? w : acc,
        ).weightGrams;

  return {
    ageDays,
    weightKg: latestWeightGrams / 1000,
    mode: ageDays < NEONATAL_MAX_AGE_DAYS ? "neonatal" : "energy",
  };
}

/**
 * Single source of the 14-day rule (CANON-7). API routes must take `mode`
 * from here rather than deriving `ageDays < 14` themselves.
 */
export function resolveMode(
  dateISO: string,
  baby: Baby,
  weights: Weight[],
  tz: string,
): "neonatal" | "energy" {
  return resolveDayContext(dateISO, baby, weights, tz).mode;
}

export function computeTarget(
  dateISO: string,
  baby: Baby,
  weights: Weight[],
  tz: string,
  formula: FormulaDensity,
): number | null {
  const { ageDays, weightKg, mode } = resolveDayContext(
    dateISO,
    baby,
    weights,
    tz,
  );

  if (mode === "neonatal") {
    return null;
  }

  const kcalKg = targetKcalPerKg(ageMonthsFromDays(ageDays));
  const dailyKcal = weightKg * kcalKg;
  const kcalPer100ml = safeKcalPer100ml(formula.kcalPer100ml);
  const dailyMl = dailyKcal / (kcalPer100ml / 100);
  return round10(dailyMl);
}

type ProteinInfo = { gPerDay: number; gPerKgDay: number } | null;

function normalizeProteinDensity(value: number | null): number | null {
  if (value === null) return null;
  if (!Number.isFinite(value)) return null;
  if (value < 0.5 || value > 5) return null;
  return value;
}

export function computeFeedingGuidance(
  dateISO: string,
  baby: Baby,
  weights: Weight[],
  tz: string,
  formula: FormulaDensity,
  preferredFeedCount: number | null = null,
): FeedingTarget {
  const { ageDays, weightKg, mode } = resolveDayContext(
    dateISO,
    baby,
    weights,
    tz,
  );

  const range = feedCountRange(ageDays);
  const center = Math.round((range[0] + range[1]) / 2);
  const feedCount =
    preferredFeedCount === null
      ? center
      : Math.min(range[1], Math.max(range[0], preferredFeedCount));

  if (mode === "neonatal") {
    const perFeedMlRange = neonatalPerFeedRange();
    const flags: NeonatalTarget["flags"] = [];
    // Zone 0–7 days: recommended per-feed volume (lower bound, 30) vs
    // 20 ml/kg (§7.5). The 8–13 day zone raises no flag.
    if (
      ageDays <= EARLY_NEWBORN_MAX_AGE_DAYS &&
      weightKg > 0 &&
      perFeedMlRange[0] > EARLY_NEWBORN_PER_FEED_ML_PER_KG * weightKg
    ) {
      flags.push({
        code: "large_single_feed_early_newborn",
        severity: "info",
        perFeedMl: perFeedMlRange[0],
        weightKg,
      });
    }
    return {
      mode: "neonatal",
      perFeedMlRange,
      feedCount,
      feedCountRange: range,
      flags,
    };
  }

  const dailyMl = computeTarget(dateISO, baby, weights, tz, formula) as number;

  const kcalPer100ml = safeKcalPer100ml(formula.kcalPer100ml);
  const dailyKcal = dailyMl * (kcalPer100ml / 100);

  // CANON-2: NO 960 clamp on the upper bound — the range always brackets dailyMl.
  const dailyMlRange: [number, number] = [
    floor10(dailyMl * (1 - DAILY_ML_RANGE_FRACTION)),
    ceil10(dailyMl * (1 + DAILY_ML_RANGE_FRACTION)),
  ];

  const mlPerFeedRange: [number, number] = [
    round5(dailyMl / range[1]),
    round5(dailyMl / range[0]),
  ];
  const mlPerFeed = round5(dailyMl / feedCount);

  const proteinDensity = normalizeProteinDensity(formula.proteinGPer100kcal);
  let protein: ProteinInfo = null;
  if (proteinDensity !== null && weightKg > 0) {
    const gPerDay = (dailyKcal * proteinDensity) / 100;
    protein = {
      gPerDay,
      gPerKgDay: gPerDay / weightKg,
    };
  }

  const aapMl = round10(weightKg * AAP_ML_PER_KG);

  const flags: TargetFlag[] = [];
  if (weightKg > 0) {
    const valueMlKg = dailyMl / weightKg;
    if (valueMlKg > ML_PER_KG_HIGH_THRESHOLD) {
      flags.push({ code: "ml_per_kg_high", severity: "warning", valueMlKg });
    } else if (valueMlKg < ML_PER_KG_LOW_THRESHOLD) {
      flags.push({ code: "ml_per_kg_low", severity: "info", valueMlKg });
    }
  }
  // CANON-2: the flag is the only carrier of the "exceeds 960" signal.
  if (dailyMl > AAP_SOFT_CAP_ML) {
    flags.push({
      code: "aap_soft_cap_exceeded",
      severity: "warning",
      source: "AAP",
      valueMl: dailyMl,
    });
  }
  // Codex density flag on the raw input density (DEFAULT 67 does not trigger).
  const rawDensity = formula.kcalPer100ml;
  if (
    Number.isFinite(rawDensity) &&
    (rawDensity < CODEX_KCAL_MIN || rawDensity > CODEX_KCAL_MAX)
  ) {
    flags.push({
      code: "density_out_of_codex_range",
      severity: "warning",
      kcalPer100ml: rawDensity,
    });
  }
  // Single-feed sanity check for the >14d zone (40 ml/kg on the ACTUAL max
  // feed) lives in the feeding layer (DayView), not here — the recommendation
  // calculation does not see real feeds. See §7.5 / plan B6.

  return {
    mode: "energy",
    dailyMl,
    dailyMlRange,
    mlPerFeed,
    mlPerFeedRange,
    feedCount,
    feedCountRange: range,
    dailyKcal,
    aapMl,
    protein,
    flags,
  };
}
