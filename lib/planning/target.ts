import type { Baby, FeedingTarget, FormulaDensity, TargetFlag, Weight } from "./types";
import { dayOfLife, startOfLocalDay } from "./dayBoundary";
import { ageMonthsFromDays, targetKcalPerKg } from "./energyCurve";
import { neonatalDailyMl } from "./neonatal";
import { feedCountCenter, feedCountRange } from "./feedCount";
import { ceil10, floor10, round5, round10 } from "@/lib/format/ml";

/** Дефолт энергоплотности при отсутствии данных (PRD §3). */
export const DEFAULT_FORMULA_DENSITY: FormulaDensity = {
  kcalPer100ml: 67,
  proteinGPer100kcal: null,
};

const NEONATAL_MAX_AGE_DAYS = 14; // ageDays < 14 → неонатальный режим (дни жизни 1..14)
const ML_PER_KG_FLAG_THRESHOLD = 200;

/** Defensive guard: невалидная плотность → дефолт 67 (PRD §4.1). */
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

/** Общий internal-хелпер: возраст, вес, режим для дня D (PRD §5.4). */
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
 * Суточная цель в мл (PRD §5.4). Сохранённый контракт: возвращает number.
 *
 *   ageDays < 14:  неонатальная линейная титрация
 *   ageDays ≥ 14:  энергетическая модель с учётом плотности смеси
 *
 * Округление — до ближайших 10 мл.
 */
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

/** Нормализация protein-плотности (PRD §4.1 / §5.4): мусор → null. */
function normalizeProteinDensity(value: number | null): number | null {
  if (value === null) return null;
  if (!Number.isFinite(value)) return null;
  if (value < 0.5 || value > 5) return null;
  return value;
}

/**
 * Расширенная рекомендация по кормлению (PRD §5.4) — только для UX DayView.
 * Внутри вызывает computeTarget — единственный источник истины для объёма.
 */
export function computeFeedingGuidance(
  dateISO: string,
  baby: Baby,
  weights: Weight[],
  tz: string,
  formula: FormulaDensity,
): FeedingTarget {
  const { ageDays, weightKg, mode } = resolveDayContext(
    dateISO,
    baby,
    weights,
    tz,
  );

  const dailyMl = computeTarget(dateISO, baby, weights, tz, formula);

  // dailyKcal восстанавливается из dailyMl и фактической плотности — так protein
  // audit согласован с реальным объёмом (в т.ч. для неонатального режима).
  const kcalPer100ml = safeKcalPer100ml(formula.kcalPer100ml);
  const dailyKcal = dailyMl * (kcalPer100ml / 100);

  const dailyMlRange: [number, number] = [
    floor10(dailyMl * 0.9),
    ceil10(dailyMl * 1.1),
  ];

  const range = feedCountRange(ageDays);
  const feedCount = feedCountCenter(baby.feedingsPerDay, range);

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
