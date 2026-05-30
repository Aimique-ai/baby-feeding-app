import type { Feeding } from "./types";

export type DayMetrics = {
  factOfDay: number;
  feedingsCount: number;
  topUpsCount: number;
  avgDurationMs: number | null;
  deficit: number | null;
  // Largest volume of a single NON-top-up feeding for the day (0 if none).
  // For the single-feed sanity check (§7.5, >14d zone): we need the max, not
  // the average.
  maxSingleFeedMl: number;
};

export function dayMetrics(
  facts: Feeding[],
  target: number | null,
): DayMetrics {
  let factOfDay = 0;
  let feedingsCount = 0;
  let topUpsCount = 0;
  let durSum = 0;
  let durN = 0;
  let maxSingleFeedMl = 0;

  for (const f of facts) {
    if (f.volumeMl != null) factOfDay += f.volumeMl;
    if (f.isTopUp) topUpsCount += 1;
    else feedingsCount += 1;
    if (!f.isTopUp && f.volumeMl != null && f.volumeMl > maxSingleFeedMl) {
      maxSingleFeedMl = f.volumeMl;
    }
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
    deficit: target == null ? null : target - factOfDay,
    maxSingleFeedMl,
  };
}
