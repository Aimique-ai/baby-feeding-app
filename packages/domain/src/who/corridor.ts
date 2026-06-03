import type { AnalyticsPoint } from "./analyticsTypes";
import { lookupWfaLMS } from "./lookup";
import { measurementFromZ, percentileFromZ, zFromPercentile } from "./zscore";

// corridor-drop is a source-backed signal, not a z-proxy.
//
// RULE — NICE faltering-growth guidance: a sustained downward drop through N
// percentile "corridors" (the bands between adjacent lines) is cause for review.
// N depends on the BIRTH-WEIGHT percentile: <P9 → 1, P9–P91 → 2, >P91 → 3.
// (Current weight <P2 is handled separately as below-p2.)
//
// GRID — the standard printed WHO percentile lines {P3,P10,P25,P50,P75,P90,P97}.
// This grid is our adaptation: WHO publishes no z-equivalent of a "corridor", so
// we take the NICE rule as-is and only map the grid onto the percentiles WHO
// already prints — far closer to source than an invented z cutoff. Lines are
// derived from the already-vendored LMS data; no new tables are needed.

type Sex = "male" | "female";

// Standard printed WHO percentile lines, ascending.
const CORRIDOR_LINES = [3, 10, 25, 50, 75, 90, 97] as const;
const MIN_POINTS = 2;

export type CorridorStatus = "red" | "warn" | "none";

export type CorridorDropResult = {
  status: CorridorStatus;
  droppedCorridors: number;
  threshold: number;
  fromPercentile: number | null;
  toPercentile: number | null;
};

// Corridor threshold N by birth-weight percentile (NICE faltering-growth rule).
function thresholdForBirthPercentile(birthPercentile: number): number {
  if (birthPercentile < 9) return 1;
  if (birthPercentile <= 91) return 2;
  return 3;
}

// Corridor band a weight falls into at a given age. 0 = below the P3 line;
// CORRIDOR_LINES.length = above the P97 line; band k = between line k-1 and k.
// A higher index means a higher percentile.
function corridorIndexAt(
  sex: Sex,
  ageDays: number,
  weightGrams: number,
): number {
  const lms = lookupWfaLMS(sex, ageDays);
  const weightKg = weightGrams / 1000;
  let band = 0;
  for (const p of CORRIDOR_LINES) {
    const lineKg = measurementFromZ(zFromPercentile(p), lms);
    if (weightKg >= lineKg) band += 1;
    else break;
  }
  return band;
}

// Drop is measured against the child's own historical peak band (tracking), not
// against the median: a child at P90 who falls to P50 has dropped two corridors
// even though the absolute weight still looks "good" — this is the NICE intent.
export function corridorDrop(
  points: AnalyticsPoint[],
  birthWeightGrams: number,
  sex: Sex,
): CorridorDropResult {
  const none: CorridorDropResult = {
    status: "none",
    droppedCorridors: 0,
    threshold: 0,
    fromPercentile: null,
    toPercentile: null,
  };
  if (points.length < MIN_POINTS || birthWeightGrams <= 0) return none;

  // Birth-weight percentile from the day-0 LMS.
  const birthLMS = lookupWfaLMS(sex, 0);
  const birthZ = zFromMeasurementSafe(birthWeightGrams / 1000, birthLMS);
  if (birthZ === null) return none;
  const birthPercentile = percentileFromZ(birthZ);
  const threshold = thresholdForBirthPercentile(birthPercentile);

  // Corridor bands from real points only (no interpolation).
  const indices = points.map((p) =>
    corridorIndexAt(sex, p.ageDays, p.weightGrams),
  );
  const latestIndex = indices[indices.length - 1];
  const maxIndex = Math.max(...indices);

  // How far the latest point sits below the historical peak band.
  const droppedCorridors = Math.max(0, maxIndex - latestIndex);

  let status: CorridorStatus = "none";
  if (droppedCorridors >= threshold) status = "red";
  else if (threshold >= 2 && droppedCorridors === threshold - 1) status = "warn";

  const maxAt = indices.indexOf(maxIndex);
  return {
    status,
    droppedCorridors,
    threshold,
    fromPercentile: points[maxAt]?.percentile ?? null,
    toPercentile: points[points.length - 1]?.percentile ?? null,
  };
}

function zFromMeasurementSafe(
  x: number,
  lms: { L: number; M: number; S: number },
): number | null {
  if (!Number.isFinite(x) || x <= 0) return null;
  const { L, M, S } = lms;
  const z = L === 0 ? Math.log(x / M) / S : (Math.pow(x / M, L) - 1) / (L * S);
  return Number.isFinite(z) ? z : null;
}
