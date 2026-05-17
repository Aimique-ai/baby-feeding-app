import { z } from "zod";
import { Types } from "mongoose";

/** ObjectId существующей смеси или null. Существование проверяется в route handler. */
const currentFormulaId = z
  .union([
    z.string().refine((v) => Types.ObjectId.isValid(v), {
      message: "invalid_formula_id",
    }),
    z.null(),
  ])
  .optional();

export const babySchema = z.object({
  name: z.string().min(1),
  birthDate: z.coerce.date(),
  birthWeightGrams: z.number().int().positive(),
  feedingsPerDay: z.number().int().min(1).max(24),
  sex: z.enum(["male", "female"]),
  currentFormulaId,
});

export const babyPatchSchema = babySchema.partial();

export type BabyInput = z.infer<typeof babySchema>;
export type BabyPatchInput = z.infer<typeof babyPatchSchema>;
