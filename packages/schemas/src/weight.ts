import { z } from "zod";
import { MAX_WEIGHT_GRAMS } from "./constants";
import { objectIdString } from "./objectId";

// ── CREATE / PATCH ──────────────────────────────────────────────────────────
// CREATE uses `dateISO` (YYYY-MM-DD calendar string); the server converts it to
// a Date via fromZonedTime. The RESPONSE uses `date` (full ISO datetime string).
// Do NOT conflate the two.

export const dateISOField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "invalid dateISO")
  .refine((v) => {
    const [y, m, d] = v.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return (
      dt.getUTCFullYear() === y &&
      dt.getUTCMonth() === m - 1 &&
      dt.getUTCDate() === d
    );
  }, "invalid calendar date");

const baseWeightShape = {
  dateISO: dateISOField,
  weightGrams: z.number().int().positive().max(MAX_WEIGHT_GRAMS),
} as const;

export const weightSchema = z.object({
  babyId: objectIdString.optional(),
  ...baseWeightShape,
});

export const weightPatchSchema = z
  .object(baseWeightShape)
  .partial()
  .refine((v) => v.dateISO !== undefined || v.weightGrams !== undefined, {
    message: "at least one field required",
  });

export type WeightInput = z.infer<typeof weightSchema>;
export type WeightPatchInput = z.infer<typeof weightPatchSchema>;

// ── RESPONSE ────────────────────────────────────────────────────────────────
// Mirrors the old SerializedWeight exactly. NOTE: response field is `date`
// (full ISO datetime string), not `dateISO`.

export const weightResponseSchema = z.object({
  _id: objectIdString,
  babyId: objectIdString,
  date: z.iso.datetime(),
  weightGrams: z.number(),
});

export type Weight = z.infer<typeof weightResponseSchema>;
