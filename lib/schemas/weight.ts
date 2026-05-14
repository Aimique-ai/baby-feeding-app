import { z } from "zod";

const objectIdString = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "invalid ObjectId");

export const weightSchema = z.object({
  babyId: objectIdString.optional(),
  date: z.coerce.date(),
  weightGrams: z.number().int().positive().max(50000),
});

export type WeightInput = z.infer<typeof weightSchema>;
