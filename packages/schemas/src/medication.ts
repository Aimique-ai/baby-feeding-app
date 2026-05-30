import { z } from "zod";
import { MED_DOSE_MAX, MED_DOSE_MIN, MED_NAME_MAX } from "./constants";
import { objectIdString } from "./objectId";

export const medicationSchema = z.object({
  babyId: objectIdString.optional(),
  name: z.string().trim().min(1).max(MED_NAME_MAX),
  defaultDoseDrops: z.number().int().min(MED_DOSE_MIN).max(MED_DOSE_MAX),
});

export const medicationPatchSchema = medicationSchema.partial();

export type MedicationInput = z.infer<typeof medicationSchema>;
export type MedicationPatchInput = z.infer<typeof medicationPatchSchema>;

export const medicationResponseSchema = z.object({
  _id: objectIdString,
  babyId: objectIdString,
  name: z.string(),
  defaultDoseDrops: z.number(),
  deletedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

export type Medication = z.infer<typeof medicationResponseSchema>;
