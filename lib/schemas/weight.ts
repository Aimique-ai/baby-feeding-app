import { z } from "zod";

const objectIdString = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "invalid ObjectId");

export const weightSchema = z.object({
  babyId: objectIdString.optional(),
  dateISO: z
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
    }, "invalid calendar date"),
  weightGrams: z.number().int().positive().max(50000),
});

export type WeightInput = z.infer<typeof weightSchema>;
