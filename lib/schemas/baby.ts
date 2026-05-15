import { z } from "zod";

export const babySchema = z.object({
  name: z.string().min(1),
  birthDate: z.coerce.date(),
  birthWeightGrams: z.number().int().positive(),
  feedingsPerDay: z.number().int().min(1).max(24),
  sex: z.enum(["male", "female"]),
});

export const babyPatchSchema = babySchema.partial();

export type BabyInput = z.infer<typeof babySchema>;
export type BabyPatchInput = z.infer<typeof babyPatchSchema>;
