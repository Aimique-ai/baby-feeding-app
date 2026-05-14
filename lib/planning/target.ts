import type { Baby, Weight } from "./types";
import { dayOfLife, startOfLocalDay } from "./dayBoundary";
import { ACTIVE_MATURE_FORMULA_ID, MATURE_FORMULAS } from "./formulas";

/**
 * PRD §4.1 — суточная цель.
 *   day 1..10:  0.02 × birthWeightGrams × n  (формула Зайцевой)
 *   day ≥ 11:   активная стратегия из MATURE_FORMULAS (см. lib/planning/formulas.ts)
 *
 * "Текущий вес" — запись с максимальной date ≤ начала дня D.
 */
export function computeTarget(
  dateISO: string,
  baby: Baby,
  weights: Weight[],
  tz: string,
): number {
  const dayStart = startOfLocalDay(dateISO, tz);
  const n = dayOfLife(baby.birthDate, dayStart, tz);

  if (n <= 10) {
    return 0.02 * baby.birthWeightGrams * n;
  }

  const eligible = weights.filter((w) => w.date.getTime() <= dayStart.getTime());
  const latestWeightGrams =
    eligible.length === 0
      ? baby.birthWeightGrams
      : eligible.reduce((acc, w) =>
          w.date.getTime() > acc.date.getTime() ? w : acc,
        ).weightGrams;

  return MATURE_FORMULAS[ACTIVE_MATURE_FORMULA_ID].compute({
    baby,
    latestWeightGrams,
    dayOfLife: n,
  });
}
