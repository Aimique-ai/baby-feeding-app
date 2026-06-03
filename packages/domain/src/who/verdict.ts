import { corridorDrop } from "./corridor";
import type {
  FeedingLink,
  GrowthVerdict,
  VerdictReason,
  VerdictSignalKey,
  WeightsAnalytics,
} from "./analyticsTypes";

const ADAPTATION_MAX_AGE_DAYS = 13;
const NO_REGAIN_AGE_DAYS = 21;
const EARLY_LOSS_RED_PCT = 10;
const EARLY_LOSS_NEAR_PCT = 7;
const BELOW_P2_PERCENTILE = 2;
const VELOCITY_Z_MILD = -1;
const VELOCITY_Z_STRONG = -2;

// ADR: only signals with a medical source may color the status (🟡/🔴).
// Everything else (velocity-z, feeding deficit, near-threshold corridor drift)
// is a neutral observation that never changes the status. These sets are the
// single source of truth for what colors the status; web imports
// STATUS_COLORING_CODES so its classifier cannot drift from the domain.
export const CLINICAL_CODES = new Set<VerdictSignalKey>([
  "below-p2",
  "early-loss-over-10",
  "no-regain-by-3w",
  "corridor-drop-red",
]);

// Intentionally empty: we have no source-backed soft 🟡. corridor-drop-warn
// (a drop one corridor short of the threshold) is our own gradation, not a NICE
// threshold, so it is an observation, not a status. The recheck path is kept
// live for a future source-backed yellow.
export const YELLOW_CODES = new Set<VerdictSignalKey>([]);

export const STATUS_COLORING_CODES: ReadonlySet<VerdictSignalKey> = new Set([
  ...CLINICAL_CODES,
  ...YELLOW_CODES,
]);

function reason(
  code: VerdictReason["code"],
  detail?: VerdictReason["detail"],
): VerdictReason {
  const isClinical =
    code !== "growth-on-track" && CLINICAL_CODES.has(code as VerdictSignalKey);
  return { code, isHeuristic: !isClinical, isClinical, detail };
}

function lossPctFromBirth(a: WeightsAnalytics): number | null {
  const min = a.points.reduce<number | null>(
    (acc, p) => (acc === null ? p.weightGrams : Math.min(acc, p.weightGrams)),
    null,
  );
  if (min === null || a.birthWeightGrams <= 0) return null;
  return ((a.birthWeightGrams - min) / a.birthWeightGrams) * 100;
}

function birthDataUsable(a: WeightsAnalytics): boolean {
  return (
    Number.isFinite(a.birthWeightGrams) &&
    a.birthWeightGrams > 0 &&
    !Number.isNaN(new Date(a.birthDate).getTime()) &&
    (a.sex === "male" || a.sex === "female")
  );
}

export function computeGrowthVerdict(
  a: WeightsAnalytics,
  feedingLink?: FeedingLink | null,
): GrowthVerdict | null {
  // No usable birth data, or fewer than 2 weigh-ins → no verdict.
  if (!birthDataUsable(a)) return null;
  if (a.points.length < 2) return null;

  const latest = a.points[a.points.length - 1];
  const ageDays = latest.ageDays;
  const inAdaptation = ageDays <= ADAPTATION_MAX_AGE_DAYS;

  const reasons: VerdictReason[] = [];
  const add = (code: VerdictSignalKey, detail?: VerdictReason["detail"]) => {
    reasons.push(reason(code, detail));
  };

  if (latest.percentile < BELOW_P2_PERCENTILE) {
    add("below-p2", { percentile: latest.percentile });
  }

  const lossPct = lossPctFromBirth(a);
  if (
    inAdaptation &&
    lossPct !== null &&
    lossPct > EARLY_LOSS_RED_PCT
  ) {
    add("early-loss-over-10", { lossPct });
  }

  const noRegain =
    ageDays >= NO_REGAIN_AGE_DAYS &&
    latest.weightGrams < a.birthWeightGrams;
  if (noRegain) add("no-regain-by-3w");

  const corridor = corridorDrop(a.points, a.birthWeightGrams, a.sex);
  if (corridor.status === "red") {
    add("corridor-drop-red", { percentile: corridor.toPercentile ?? undefined });
  } else if (corridor.status === "warn") {
    add("corridor-drop-warn", {
      percentile: corridor.toPercentile ?? undefined,
    });
  }

  // Computed after every clinical signal, including corridor-drop-red.
  const hasClinical = reasons.some((r) => r.isClinical);

  // velocity-z is observation-only; it never colors the status (see ADR above).
  const mv = a.monthlyVelocity;
  if (mv) {
    if (mv.z < VELOCITY_Z_STRONG) {
      add("velocity-low-strong", { z: mv.z, intervalDays: mv.intervalDays });
    } else if (mv.z < VELOCITY_Z_MILD) {
      add("velocity-low-mild", { z: mv.z, intervalDays: mv.intervalDays });
    }
  }

  if (
    inAdaptation &&
    lossPct !== null &&
    lossPct > EARLY_LOSS_NEAR_PCT &&
    lossPct <= EARLY_LOSS_RED_PCT
  ) {
    add("early-loss-near-10-info", { lossPct });
  }
  // Fast gain can't be judged without length (weight-for-length), so info only.
  if (
    a.percentileTrend &&
    a.percentileTrend.toPercentile - a.percentileTrend.fromPercentile >= 15
  ) {
    add("fast-gain-info", { percentile: a.percentileTrend.toPercentile });
  }

  applyFreshDeficit(a, feedingLink, add);

  let boundaryState: GrowthVerdict["boundaryState"];
  if (inAdaptation) {
    boundaryState = a.earlyVelocity ? "adaptation" : "adaptation-loss-only";
  } else if (!mv) {
    boundaryState = "velocity-unavailable";
  } else if (!feedingLink || feedingLink.fresh === null) {
    boundaryState = "no-deficit-axis";
  } else {
    boundaryState = "ok";
  }

  const status: GrowthVerdict["status"] = hasClinical
    ? "clinical-attention"
    : reasons.some((r) => !r.isClinical && isYellow(r.code))
      ? "recheck"
      : "on-track";

  if (status === "on-track" && reasons.length === 0) {
    reasons.push(reason("growth-on-track"));
  }

  reasons.sort((x, y) => severity(y) - severity(x));
  const signals = reasons
    .filter((r): r is VerdictReason & { code: VerdictSignalKey } =>
      r.code !== "growth-on-track",
    )
    .map((r) => r.code);

  return { status, boundaryState, signals, reasons };
}

function isYellow(code: VerdictReason["code"]): boolean {
  return code !== "growth-on-track" && YELLOW_CODES.has(code as VerdictSignalKey);
}

function severity(r: VerdictReason): number {
  if (r.isClinical) return 3;
  if (isYellow(r.code)) return 2;
  if (r.code === "growth-on-track") return 0;
  return 1; // info
}

function applyFreshDeficit(
  a: WeightsAnalytics,
  feedingLink: FeedingLink | null | undefined,
  add: (code: VerdictSignalKey, detail?: VerdictReason["detail"]) => void,
): void {
  const fresh = feedingLink?.fresh;
  if (!fresh || fresh.avgDeficitMl === null) return;

  const mv = a.monthlyVelocity;
  const detail = {
    avgDeficitMl: fresh.avgDeficitMl ?? undefined,
    avgTargetMl: fresh.avgTargetMl ?? undefined,
  };

  // A recent feeding deficit only pairs with completed velocity when the deficit
  // window falls strictly after that velocity interval — otherwise the velocity
  // already reflects it, and we emit the plain neutral note instead.
  const velocityGreen = mv !== null && mv.z >= VELOCITY_Z_MILD;
  const windowStrictlyLater = mv !== null && fresh.fromDate > mv.toDateISO;

  if (
    velocityGreen &&
    fresh.exceedsYellowThreshold &&
    windowStrictlyLater
  ) {
    add("fresh-deficit-vs-stale-velocity", detail);
  } else if (
    fresh.exceedsYellowThreshold &&
    (mv === null || !windowStrictlyLater)
  ) {
    add("fresh-deficit-neutral-info", detail);
  }
}
