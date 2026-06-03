import { z } from "zod";

// `dateISO` is a YYYY-MM-DD CALENDAR string (not a full timestamp), so it is a
// plain z.string() — NOT z.iso.datetime(). Only true serialized timestamps
// (startAt/endAt/birthDate/date/createdAt/...) use z.iso.datetime().

const modeEnum = z.enum(["neonatal", "energy"]);

// The history route spreads the full result of dayMetrics() into each item
// (`{ dateISO, dol, target, mode, ...m }`). dayMetrics returns SIX fields,
// including `maxSingleFeedMl` — the schema MUST include it, or .parse() at the
// http boundary would silently strip it from the real payload.

export const historyItemSchema = z.object({
  dateISO: z.string(),
  dol: z.number(),
  target: z.number().nullable(),
  mode: modeEnum,
  factOfDay: z.number(),
  feedingsCount: z.number(),
  topUpsCount: z.number(),
  avgDurationMs: z.number().nullable(),
  deficit: z.number().nullable(),
  maxSingleFeedMl: z.number(),
});

export type HistoryItem = z.infer<typeof historyItemSchema>;

export const historyPageSchema = z.object({
  items: z.array(historyItemSchema),
  nextCursor: z.string().nullable(),
});

export type HistoryPage = z.infer<typeof historyPageSchema>;

export const feedingsAnalyticsItemSchema = z.object({
  dateISO: z.string(),
  dol: z.number(),
  target: z.number().nullable(),
  mode: modeEnum,
  fact: z.number(),
});

export type FeedingsAnalyticsItem = z.infer<typeof feedingsAnalyticsItemSchema>;

export const feedingsAnalyticsResponseSchema = z.object({
  tz: z.string(),
  items: z.array(feedingsAnalyticsItemSchema),
});

export type FeedingsAnalyticsResponse = z.infer<
  typeof feedingsAnalyticsResponseSchema
>;

export const durationChipsSchema = z.object({
  chips: z.array(z.number()),
});

export type DurationChips = z.infer<typeof durationChipsSchema>;

// Response contract for /api/weights/analytics. verdict/feedingLink are REQUIRED
// keys (null is valid, but the key is always present — not .optional()); a
// silently dropped key would otherwise go unnoticed. With no tests in the repo,
// this schema is the only automatic check on the payload shape.

const sexEnum = z.enum(["male", "female"]);

const analyticsPointSchema = z.object({
  _id: z.string(),
  date: z.iso.datetime(),
  weightGrams: z.number(),
  ageDays: z.number(),
  zWeightForAge: z.number(),
  percentile: z.number(),
  daysSincePrev: z.number().nullable(),
  deltaSincePrev: z.number().nullable(),
  gramsPerDay: z.number().nullable(),
});

const weeklyGainRowSchema = z.object({
  kind: z.enum(["adaptation", "gain"]),
  fromDay: z.number(),
  toDay: z.number(),
  fromGrams: z.number(),
  toGrams: z.number(),
  deltaGrams: z.number(),
  days: z.number(),
  gramsPerDay: z.number().nullable(),
  percentile: z.number(),
  nadirGrams: z.number().optional(),
  nadirDay: z.number().optional(),
  lossPct: z.number().optional(),
  recovered: z.boolean().optional(),
});

const earlyClassEnum = z.enum([
  "p50+",
  "p25-50",
  "p10-25",
  "p5-10",
  "below-p5",
]);

const analyticsEarlyRefSchema = z.object({
  intervalLabel: z.string(),
  birthWeightGroup: z.string(),
  p50: z.number(),
  p25: z.number(),
  p10: z.number(),
  p5: z.number(),
});

const analyticsVelocitySchema = z.object({
  source: z.enum(["who-lms", "who-early"]),
  intervalLabel: z.string(),
  intervalDays: z.number(),
  fromDate: z.string(),
  toDate: z.string(),
  fromWeightGrams: z.number(),
  toWeightGrams: z.number(),
  deltaGrams: z.number(),
  z: z.number().nullable(),
  percentile: z.number().nullable(),
  earlyClass: earlyClassEnum.optional(),
  earlyRef: analyticsEarlyRefSchema.optional(),
  toDateISO: z.string().optional(),
  nextWeighInDateISO: z.string().nullable().optional(),
});

const monthlyVelocitySchema = z.object({
  fromDate: z.string(),
  toDate: z.string(),
  fromWeightGrams: z.number(),
  toWeightGrams: z.number(),
  deltaGrams: z.number(),
  intervalLabel: z.string(),
  intervalDays: z.number(),
  z: z.number(),
  percentile: z.number(),
  toDateISO: z.string(),
  nextWeighInDateISO: z.string().nullable(),
});

const percentileTrendSchema = z.object({
  fromPercentile: z.number(),
  toPercentile: z.number(),
  fromDate: z.string(),
  toDate: z.string(),
});

const verdictStatusEnum = z.enum([
  "on-track",
  "recheck",
  "clinical-attention",
]);

const verdictBoundaryStateEnum = z.enum([
  "ok",
  "insufficient-weighings",
  "missing-birth-data",
  "adaptation",
  "adaptation-loss-only",
  "velocity-unavailable",
  "no-deficit-axis",
]);

const verdictSignalKeyEnum = z.enum([
  "below-p2",
  "early-loss-over-10",
  "no-regain-by-3w",
  "corridor-drop-red",
  "corridor-drop-warn",
  "velocity-low-mild",
  "velocity-low-strong",
  "fresh-deficit-vs-stale-velocity",
  "early-loss-near-10-info",
  "fast-gain-info",
  "fresh-deficit-neutral-info",
]);

const verdictReasonSchema = z.object({
  code: z.union([verdictSignalKeyEnum, z.literal("growth-on-track")]),
  isHeuristic: z.boolean(),
  isClinical: z.boolean(),
  detail: z
    .object({
      z: z.number().optional(),
      lossPct: z.number().optional(),
      percentile: z.number().optional(),
      avgDeficitMl: z.number().optional(),
      avgTargetMl: z.number().optional(),
      intervalDays: z.number().optional(),
    })
    .optional(),
});

const growthVerdictSchema = z.object({
  status: verdictStatusEnum,
  boundaryState: verdictBoundaryStateEnum,
  signals: z.array(verdictSignalKeyEnum),
  reasons: z.array(verdictReasonSchema),
});

const freshDeficitWindowSchema = z.object({
  windowKind: z.literal("fresh-recent"),
  fromDate: z.string(),
  toDate: z.string(),
  daysCounted: z.number(),
  daysInWindow: z.number(),
  avgDeficitMl: z.number().nullable(),
  avgTargetMl: z.number().nullable(),
  exceedsYellowThreshold: z.boolean(),
});

const feedingLinkSchema = z.object({
  fresh: freshDeficitWindowSchema.nullable(),
  hypothesis: z.enum([
    "intake-likely-low",
    "plan-held-no-growth",
    "fresh-slip-not-yet-reflected",
    "no-axis",
  ]),
});

export const weightsAnalyticsResponseSchema = z.object({
  birthDate: z.iso.datetime(),
  birthWeightGrams: z.number(),
  sex: sexEnum,
  ageDaysNow: z.number(),
  points: z.array(analyticsPointSchema),
  weeklyGain: z.array(weeklyGainRowSchema),
  earlyVelocity: analyticsVelocitySchema.nullable(),
  monthlyVelocity: monthlyVelocitySchema.nullable(),
  percentileTrend: percentileTrendSchema.nullable(),
  verdict: growthVerdictSchema.nullable(),
  feedingLink: feedingLinkSchema.nullable(),
});

export type WeightsAnalyticsResponse = z.infer<
  typeof weightsAnalyticsResponseSchema
>;
