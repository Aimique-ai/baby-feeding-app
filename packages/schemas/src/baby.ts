import { z } from "zod";
import { BIRTH_WEIGHT_MAX, BIRTH_WEIGHT_MIN } from "./constants";

/** ObjectId существующей смеси или null. Существование проверяется в route handler. */
const currentFormulaId = z
  .union([
    z.string().regex(/^[a-fA-F0-9]{24}$/, "invalid_formula_id"),
    z.null(),
  ])
  .optional();

export const babySchema = z.object({
  name: z.string().min(1),
  birthDate: z.coerce.date(),
  birthWeightGrams: z
    .number()
    .int()
    .min(BIRTH_WEIGHT_MIN)
    .max(BIRTH_WEIGHT_MAX),
  sex: z.enum(["male", "female"]),
  currentFormulaId,
  preferredFeedCount: z.number().int().min(1).max(20).nullable().optional(),
});

export const babyPatchSchema = babySchema.partial();

export type BabyInput = z.infer<typeof babySchema>;
export type BabyPatchInput = z.infer<typeof babyPatchSchema>;
