/**
 * Client-safe types for weight analytics. Do not import server-only utilities
 * from this file — types only.
 */

export type AnalyticsVelocitySource = "who-lms" | "who-early";
export type AnalyticsEarlyClass =
  | "p50+"
  | "p25-50"
  | "p10-25"
  | "p5-10"
  | "below-p5";

export type AnalyticsEarlyRef = {
  intervalLabel: string;
  birthWeightGroup: string;
  p50: number;
  p25: number;
  p10: number;
  p5: number;
};

export type AnalyticsVelocity = {
  source: AnalyticsVelocitySource;
  intervalLabel: string;
  intervalDays: number;
  fromDate: string;
  toDate: string;
  fromWeightGrams: number;
  toWeightGrams: number;
  deltaGrams: number;
  z: number | null;
  percentile: number | null;
  earlyClass?: AnalyticsEarlyClass;
  earlyRef?: AnalyticsEarlyRef;
  toDateISO?: string;
  nextWeighInDateISO?: string | null;
};

export type AnalyticsPoint = {
  _id: string;
  date: string;
  weightGrams: number;
  ageDays: number;
  zWeightForAge: number;
  percentile: number;
  daysSincePrev: number | null;
  deltaSincePrev: number | null;
  gramsPerDay: number | null;
};

// Per-segment gain summary (replaces the noisy raw weigh-in log).
// adaptation: days 0–14 — loss/recovery (no g/day);
// gain: greedy chain of ≥7-day segments — honest g/day from real weigh-ins.
export type WeeklyGainRow = {
  kind: "adaptation" | "gain";
  fromDay: number;
  toDay: number;
  fromGrams: number;
  toGrams: number;
  deltaGrams: number;
  days: number;
  gramsPerDay: number | null; // null for adaptation
  percentile: number; // WFA percentile at the segment's end boundary
  nadirGrams?: number; // adaptation: lowest weight
  nadirDay?: number;
  lossPct?: number; // adaptation: % loss from birth weight
  recovered?: boolean; // adaptation: whether birth weight is regained
};

export type MonthlyVelocity = {
  fromDate: string;
  toDate: string;
  fromWeightGrams: number;
  toWeightGrams: number;
  deltaGrams: number;
  intervalLabel: string;
  intervalDays: number;
  z: number;
  percentile: number;
  // tz-normalized end boundary (localDateISO of toDate). Compare against this,
  // not the raw UTC toDate, which would be off-by-one outside UTC.
  toDateISO: string;
  nextWeighInDateISO: string | null;
};

export type PercentileTrend = {
  fromPercentile: number;
  toPercentile: number;
  fromDate: string;
  toDate: string;
};

/* ------------------------------------------------------------------ */
/* Growth verdict                                                      */
/* ------------------------------------------------------------------ */

// Semantics, not color: web maps status/signal to color and copy.
export type VerdictStatus = "on-track" | "recheck" | "clinical-attention";

export type VerdictBoundaryState =
  | "ok"
  | "insufficient-weighings" // <2 weigh-ins
  | "missing-birth-data"
  | "adaptation" // days 0–13
  | "adaptation-loss-only" // earlyVelocity==null (term <2500g / uncovered boundary)
  | "velocity-unavailable" // monthlyVelocity==null (boundary uncovered ±3d)
  | "no-deficit-axis"; // plan not set up / feeding read failed

export type VerdictSignalKey =
  // Clinical (may color 🔴) — all source-backed:
  | "below-p2"
  | "early-loss-over-10"
  | "no-regain-by-3w"
  | "corridor-drop-red" // NICE corridor rule over the WHO percentile grid
  // Near-threshold corridor drift — our gradation, observation-only:
  | "corridor-drop-warn"
  // Neutral info (never colors the status — no source threshold exists):
  | "velocity-low-mild"
  | "velocity-low-strong"
  | "fresh-deficit-vs-stale-velocity"
  | "early-loss-near-10-info"
  | "fast-gain-info"
  | "fresh-deficit-neutral-info";

export type VerdictReasonCode = VerdictSignalKey | "growth-on-track";

export type VerdictReasonDetail = {
  z?: number;
  lossPct?: number;
  percentile?: number;
  avgDeficitMl?: number;
  avgTargetMl?: number;
  intervalDays?: number;
};

export type VerdictReason = {
  code: VerdictReasonCode;
  isHeuristic: boolean;
  isClinical: boolean;
  detail?: VerdictReasonDetail;
};

export type GrowthVerdict = {
  status: VerdictStatus;
  boundaryState: VerdictBoundaryState;
  signals: VerdictSignalKey[];
  reasons: VerdictReason[];
};

export type FreshDeficitWindow = {
  windowKind: "fresh-recent";
  fromDate: string;
  toDate: string;
  daysCounted: number;
  daysInWindow: number;
  avgDeficitMl: number | null;
  avgTargetMl: number | null;
  exceedsYellowThreshold: boolean;
};

export type FeedingHypothesis =
  | "intake-likely-low"
  | "plan-held-no-growth"
  | "fresh-slip-not-yet-reflected"
  | "no-axis";

export type FeedingLink = {
  fresh: FreshDeficitWindow | null;
  hypothesis: FeedingHypothesis;
};

export type WeightsAnalytics = {
  birthDate: string;
  birthWeightGrams: number;
  sex: "male" | "female";
  ageDaysNow: number;
  points: AnalyticsPoint[];
  weeklyGain: WeeklyGainRow[];
  earlyVelocity: AnalyticsVelocity | null;
  monthlyVelocity: MonthlyVelocity | null;
  percentileTrend: PercentileTrend | null;
  verdict: GrowthVerdict | null;
  feedingLink: FeedingLink | null;
};
