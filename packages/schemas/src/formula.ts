import { z } from "zod";

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
