import { z } from "zod";

const objectIdString = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "invalid ObjectId");

export const medicationSchema = z.object({
  babyId: objectIdString.optional(),
  name: z.string().trim().min(1).max(50),
  defaultDoseDrops: z.number().int().min(1).max(100),
});

export const medicationPatchSchema = medicationSchema.partial();

export type MedicationInput = z.infer<typeof medicationSchema>;
export type MedicationPatchInput = z.infer<typeof medicationPatchSchema>;
