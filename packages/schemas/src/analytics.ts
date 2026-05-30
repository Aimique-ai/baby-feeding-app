import { z } from "zod";

// Response schemas for the analytics endpoints that previously declared inline
// shapes both on the API and re-declared on the frontend.
//
// NOTE: `dateISO` here is a YYYY-MM-DD CALENDAR string (not a full timestamp),
// so it is a plain z.string() — NOT z.iso.datetime(). Only true serialized
// timestamps (startAt/endAt/birthDate/date/createdAt/...) use z.iso.datetime().

const modeEnum = z.enum(["neonatal", "energy"]);

// ── GET /history ────────────────────────────────────────────────────────────
// Replaces HistoryDayItem / HistoryPage (was declared in
// apps/web/app/lib/api/history.ts) and the inline item type in
// apps/api/src/routes/history.ts.
//
// IMPORTANT: the history route spreads the full result of dayMetrics() into each
// item (`{ dateISO, dol, target, mode, ...m }`). dayMetrics returns SIX fields,
// including `maxSingleFeedMl` — which the old inline/frontend types omitted. The
// schema MUST include it, or .parse() at the http boundary would silently strip
// it from the real payload (defeating the single-source-of-truth goal).

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

// ── GET /feedings/analytics ─────────────────────────────────────────────────
// Replaces FeedingsAnalyticsItem / FeedingsAnalyticsResponse (was declared in
// apps/web/app/lib/api/feedings.ts) and the inline shape in
// apps/api/src/routes/feedings.analytics.ts.

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

// ── GET /feedings/analytics/duration-chips ──────────────────────────────────

export const durationChipsSchema = z.object({
  chips: z.array(z.number()),
});

export type DurationChips = z.infer<typeof durationChipsSchema>;
