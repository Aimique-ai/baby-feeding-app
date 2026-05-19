import { z } from "zod";
import {
  MED_DOSE_MAX,
  MED_DOSE_MIN,
  MED_NAME_MAX,
} from "@/lib/schemas/constants";

const objectIdString = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "invalid ObjectId");

export const medicationSchema = z.object({
  babyId: objectIdString.optional(),
  name: z.string().trim().min(1).max(MED_NAME_MAX),
  defaultDoseDrops: z.number().int().min(MED_DOSE_MIN).max(MED_DOSE_MAX),
});

export const medicationPatchSchema = medicationSchema.partial();

export type MedicationInput = z.infer<typeof medicationSchema>;
export type MedicationPatchInput = z.infer<typeof medicationPatchSchema>;
