import { z } from "zod";
import { BIRTH_WEIGHT_MAX, BIRTH_WEIGHT_MIN } from "./constants";
import { objectIdString } from "./objectId";
import { formulaResponseSchema } from "./formula";

/** ObjectId of an existing formula or null. Existence is checked in the route handler. */
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
});

export const babyPatchSchema = babySchema.partial();

export type BabyInput = z.infer<typeof babySchema>;
export type BabyPatchInput = z.infer<typeof babyPatchSchema>;

export const babyResponseSchema = z.object({
  _id: objectIdString,
  name: z.string(),
  birthDate: z.iso.datetime(),
  birthWeightGrams: z.number(),
  sex: z.enum(["male", "female"]),
  currentFormulaId: objectIdString.nullable(),
  archivedAt: z.iso.datetime().nullable(),
});

export type Baby = z.infer<typeof babyResponseSchema>;

export const babyWithFormulaResponseSchema = babyResponseSchema.extend({
  formula: formulaResponseSchema.nullable(),
});

export type BabyWithFormula = z.infer<typeof babyWithFormulaResponseSchema>;
