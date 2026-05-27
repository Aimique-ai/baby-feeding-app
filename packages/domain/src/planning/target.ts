import type {
  Baby,
  FeedingTarget,
  FormulaDensity,
  TargetFlag,
  Weight,
} from "./types";
import { dayOfLife, startOfLocalDay } from "./dayBoundary";
import { ageMonthsFromDays, targetKcalPerKg } from "./energyCurve";
import { neonatalDailyMl } from "./neonatal";
import { feedCountRange } from "./feedCount";
import { ceil10, floor10, round5, round10 } from "../math/round";

export const DEFAULT_FORMULA_DENSITY: FormulaDensity = {
  kcalPer100ml: 67,
  proteinGPer100kcal: null,
};

const NEONATAL_MAX_AGE_DAYS = 14;
const ML_PER_KG_FLAG_THRESHOLD = 200;
// FAO/WHO/UNU 2004: CV(TEE/кг/сут) ≈ 15% — ±1 SD здоровой популяции.
// https://www.fao.org/4/y5686e/y5686e05.htm
const DAILY_ML_RANGE_FRACTION = 0.15;
// AAP: практический верхний потолок суточного объёма смеси.
const DAILY_ML_RANGE_HARD_CAP_ML = 960;

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

export function computeTarget(
  dateISO: string,
  baby: Baby,
  weights: Weight[],
  tz: string,
  formula: FormulaDensity,
): number {
  const { ageDays, weightKg, mode } = resolveDayContext(
    dateISO,
    baby,
    weights,
    tz,
  );

  if (mode === "neonatal") {
    const birthWeightKg = baby.birthWeightGrams / 1000;
    return round10(neonatalDailyMl(birthWeightKg, weightKg, ageDays));
  }

  const kcalKg = targetKcalPerKg(ageMonthsFromDays(ageDays));
  const dailyKcal = weightKg * kcalKg;
  const kcalPer100ml = safeKcalPer100ml(formula.kcalPer100ml);
  const dailyMl = dailyKcal / (kcalPer100ml / 100);
  return round10(dailyMl);
}

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

  const dailyMl = computeTarget(dateISO, baby, weights, tz, formula);

  const kcalPer100ml = safeKcalPer100ml(formula.kcalPer100ml);
  const dailyKcal = dailyMl * (kcalPer100ml / 100);

  const dailyMlRange: [number, number] = [
    floor10(dailyMl * (1 - DAILY_ML_RANGE_FRACTION)),
    ceil10(
      Math.min(dailyMl * (1 + DAILY_ML_RANGE_FRACTION), DAILY_ML_RANGE_HARD_CAP_ML),
    ),
  ];

  const range = feedCountRange(ageDays);
  const center = Math.round((range[0] + range[1]) / 2);
  const feedCount =
    preferredFeedCount === null
      ? center
      : Math.min(range[1], Math.max(range[0], preferredFeedCount));

  const mlPerFeedRange: [number, number] = [
    round5(dailyMl / range[1]),
    round5(dailyMl / range[0]),
  ];
  const mlPerFeed = round5(dailyMl / feedCount);

  const proteinDensity = normalizeProteinDensity(formula.proteinGPer100kcal);
  let protein: FeedingTarget["protein"] = null;
  if (proteinDensity !== null && weightKg > 0) {
    const gPerDay = (dailyKcal * proteinDensity) / 100;
    protein = {
      gPerDay,
      gPerKgDay: gPerDay / weightKg,
    };
  }

  const flags: TargetFlag[] = [];
  if (weightKg > 0) {
    const valueMlKg = dailyMl / weightKg;
    if (valueMlKg > ML_PER_KG_FLAG_THRESHOLD) {
      flags.push({ code: "ml_per_kg_high", valueMlKg });
    }
  }

  return {
    dailyMl,
    dailyMlRange,
    mlPerFeed,
    mlPerFeedRange,
    feedCount,
    feedCountRange: range,
    dailyKcal,
    mode,
    protein,
    flags,
  };
}
