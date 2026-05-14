import type { Feeding } from "./types";

export type DayMetrics = {
  factOfDay: number;
  feedingsCount: number;
  topUpsCount: number;
  avgDurationMs: number | null;
  deficit: number; // target - factOfDay (>0 = under, <0 = over)
};

/**
 * PRD §4.6 — метрики истории дня.
 *   factOfDay      = Σ volumeMl (вкл. докормы, исключая null)
 *   feedingsCount  = записей с isTopUp=false
 *   topUpsCount    = записей с isTopUp=true
 *   avgDurationMs  = среднее (endAt − startAt) по основным с endAt != null
 *   deficit        = target − factOfDay
 */
export function dayMetrics(facts: Feeding[], target: number): DayMetrics {
  let factOfDay = 0;
  let feedingsCount = 0;
  let topUpsCount = 0;
  let durSum = 0;
  let durN = 0;

  for (const f of facts) {
    if (f.volumeMl != null) factOfDay += f.volumeMl;
    if (f.isTopUp) topUpsCount += 1;
    else feedingsCount += 1;
    if (!f.isTopUp && f.endAt != null) {
      durSum += f.endAt.getTime() - f.startAt.getTime();
      durN += 1;
    }
  }

  return {
    factOfDay,
    feedingsCount,
    topUpsCount,
    avgDurationMs: durN > 0 ? durSum / durN : null,
    deficit: target - factOfDay,
  };
}
