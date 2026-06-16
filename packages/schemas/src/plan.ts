import { z } from "zod";
import type { Baby } from "./baby";
import type { Feeding } from "./feeding";
import type { Weight } from "./weight";

// Plan-shaped deserialized aliases (consumed by @leon/domain planning types).
// Kept as distinct exports so the planning surface doesn't have to know about
// the Mongo serialization shape directly.

export type PlanFeeding = {
  _id: string;
  startAt: Date;
  endAt: Date | null;
  volumeMl: number | null;
  isTopUp: boolean;
};

export type PlanBaby = {
  birthDate: Date;
  birthWeightGrams: number;
};

export type PlanWeight = {
  date: Date;
  weightGrams: number;
};

export function deserializeFeeding(s: Feeding): PlanFeeding {
  return {
    _id: s._id,
    startAt: new Date(s.startAt),
    endAt: s.endAt ? new Date(s.endAt) : null,
    volumeMl: s.volumeMl,
    isTopUp: s.isTopUp,
  };
}

export function deserializeBaby(s: Baby): PlanBaby {
  return {
    birthDate: new Date(s.birthDate),
    birthWeightGrams: s.birthWeightGrams,
  };
}

export function deserializeWeight(s: Weight): PlanWeight {
  return {
    date: new Date(s.date),
    weightGrams: s.weightGrams,
  };
}

// --- Feeding plan endpoint (GET /api/feedings/plan) ----------------------
//
// Server-computed plan. The client reconstructs DayView's view from this WITHOUT
// re-running the engine: `guidance` mirrors the @leon/domain FeedingTarget union,
// `nextFeeding` is the single next-feeding window (or null) shared with the
// reminder scheduler. Times are ISO strings (deserialize with deserializeFeedingPlan).

const targetFlagSchema = z.discriminatedUnion("code", [
  z.object({
    code: z.literal("ml_per_kg_high"),
    severity: z.literal("warning"),
    valueMlKg: z.number(),
  }),
  z.object({
    code: z.literal("ml_per_kg_low"),
    severity: z.literal("info"),
    valueMlKg: z.number(),
  }),
  z.object({
    code: z.literal("aap_soft_cap_exceeded"),
    severity: z.literal("warning"),
    source: z.literal("AAP"),
    valueMl: z.number(),
  }),
  z.object({
    code: z.literal("density_out_of_codex_range"),
    severity: z.literal("warning"),
    kcalPer100ml: z.number(),
  }),
  z.object({
    code: z.literal("large_single_feed_early_newborn"),
    severity: z.literal("info"),
    perFeedMl: z.number(),
    weightKg: z.number(),
  }),
  z.object({
    code: z.literal("single_feed_unusually_large_for_weight"),
    severity: z.literal("info"),
    perFeedMl: z.number(),
    weightKg: z.number(),
  }),
]);

const range2 = z.tuple([z.number(), z.number()]);

const energyGuidanceSchema = z.object({
  mode: z.literal("energy"),
  dailyMl: z.number(),
  dailyMlRange: range2,
  mlPerFeedRange: range2,
  feedCountRange: range2,
  dailyKcal: z.number(),
  aapMl: z.number(),
  protein: z
    .object({ gPerDay: z.number(), gPerKgDay: z.number() })
    .nullable(),
  flags: z.array(targetFlagSchema),
});

const neonatalGuidanceSchema = z.object({
  mode: z.literal("neonatal"),
  perFeedMlRange: range2,
  feedCountRange: range2,
  flags: z.array(targetFlagSchema),
});

const guidanceSchema = z.discriminatedUnion("mode", [
  energyGuidanceSchema,
  neonatalGuidanceSchema,
]);

const nextFeedingSchema = z.object({
  timeISO: z.iso.datetime(),
  volumeMl: z.number(), // 0 for neonatal
  windowStartISO: z.iso.datetime(),
  windowEndISO: z.iso.datetime(),
});

export const feedingPlanResponseSchema = z.object({
  tz: z.string(),
  consumed: z.number(),
  nextFeeding: nextFeedingSchema.nullable(),
  guidance: guidanceSchema,
});

export type FeedingPlanResponse = z.infer<typeof feedingPlanResponseSchema>;

export type DeserializedNextFeeding = {
  time: Date;
  volumeMl: number;
  windowStart: Date;
  windowEnd: Date;
};

export type DeserializedFeedingPlan = Omit<FeedingPlanResponse, "nextFeeding"> & {
  nextFeeding: DeserializedNextFeeding | null;
};

export function deserializeFeedingPlan(
  s: FeedingPlanResponse,
): DeserializedFeedingPlan {
  return {
    tz: s.tz,
    consumed: s.consumed,
    guidance: s.guidance,
    nextFeeding: s.nextFeeding
      ? {
          time: new Date(s.nextFeeding.timeISO),
          volumeMl: s.nextFeeding.volumeMl,
          windowStart: new Date(s.nextFeeding.windowStartISO),
          windowEnd: new Date(s.nextFeeding.windowEndISO),
        }
      : null,
  };
}
