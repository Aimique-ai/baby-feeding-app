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
// Single-feed sanity check (§7.5, эвристика — НЕ клинический cap).
// 0–7 дней: объём на кормление > 20 мл/кг → info (осторожность, Front Pediatr 2023).
const EARLY_NEWBORN_MAX_AGE_DAYS = 7;
const EARLY_NEWBORN_PER_FEED_ML_PER_KG = 20;
// FAO/WHO/UNU 2004: CV(TEE/кг/сут) ≈ 15% — ±1 SD здоровой популяции.
// https://www.fao.org/4/y5686e/y5686e05.htm
const DAILY_ML_RANGE_FRACTION = 0.15;
// AAP: практический верхний потолок суточного объёма смеси.
// Используется ТОЛЬКО как порог мягкого флага — НЕ как клэмп диапазона.
const AAP_SOFT_CAP_ML = 960;
// AAP sanity-check по объёму: weight_kg × 165 мл.
const AAP_ML_PER_KG = 165;
// Codex: допустимая энергоплотность готовой смеси 60–70 ккал/100 мл.
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
 * Единственный источник правила 14 дней (CANON-7). API-роуты должны
 * брать `mode` отсюда, а не выводить `ageDays < 14` у себя.
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
    // Зона 0–7 дней: рекомендованный объём на кормление (нижний край, 30)
    // против 20 мл/кг (§7.5). Зона 8–13д флага не даёт.
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

  // CANON-2: НЕТ клэмпа 960 на верхнюю границу — диапазон всегда брекетит dailyMl.
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
  // CANON-2: флаг — единственный носитель сигнала "превышает 960".
  if (dailyMl > AAP_SOFT_CAP_ML) {
    flags.push({
      code: "aap_soft_cap_exceeded",
      severity: "warning",
      source: "AAP",
      valueMl: dailyMl,
    });
  }
  // Codex density flag по сырой входной плотности (DEFAULT 67 не триггерит).
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
  // Single-feed sanity check зоны >14д (40 мл/кг на ФАКТИЧЕСКОМ макс-кормлении)
  // живёт в слое кормлений (DayView), не здесь — рекомендательный расчёт не
  // видит реальных кормлений. См. §7.5 / план B6.

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
