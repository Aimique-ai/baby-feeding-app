import { z } from "zod";
import { objectIdString } from "./objectId";

// ── CREATE / PATCH ──────────────────────────────────────────────────────────

export const formulaSchema = z.object({
  name: z.string().trim().min(1).max(100),
  brand: z.string().trim().min(1).max(100).optional(),
  kcalPer100mlReady: z.number().min(40).max(100),
  proteinGPer100kcal: z.number().min(0.5).max(5),
  proteinGPer100mlReady: z.number().min(0.5).max(5).optional(),
  stage: z.number().int().min(1).max(3).optional(),
  kind: z.enum(["standard"]).optional(),
});

export const formulaPatchSchema = formulaSchema.partial();

export type FormulaInput = z.infer<typeof formulaSchema>;
export type FormulaPatchInput = z.infer<typeof formulaPatchSchema>;

// ── RESPONSE ────────────────────────────────────────────────────────────────
// Mirrors the old SerializedFormula exactly: brand nullable, stage required
// (serializer defaults to 1), kind literal "standard", isSystem required,
// archivedAt nullable ISO datetime string.

export const formulaResponseSchema = z.object({
  _id: objectIdString,
  name: z.string(),
  brand: z.string().nullable(),
  kcalPer100mlReady: z.number(),
  proteinGPer100kcal: z.number(),
  proteinGPer100mlReady: z.number().nullable(),
  stage: z.number(),
  kind: z.literal("standard"),
  isSystem: z.boolean(),
  archivedAt: z.iso.datetime().nullable(),
});

export type Formula = z.infer<typeof formulaResponseSchema>;
