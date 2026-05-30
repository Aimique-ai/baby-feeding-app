import { z } from "zod";
import {
  FEEDING_DURATION_MAX_MIN,
  FEEDING_VOLUME_MAX,
  FEEDING_VOLUME_MIN,
  MED_DOSE_MAX,
  MED_DOSE_MIN,
} from "./constants";
import { objectIdString } from "./objectId";

const MAX_FEEDING_DURATION_MS = FEEDING_DURATION_MAX_MIN * 60 * 1000;

const baseFeedingShape = {
  babyId: objectIdString.optional(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date().nullable().optional(),
  volumeMl: z.number().min(FEEDING_VOLUME_MIN).max(FEEDING_VOLUME_MAX),
  isTopUp: z.boolean().default(false),
  medicationId: objectIdString.nullable().optional(),
  medicationDoseDrops: z
    .number()
    .int()
    .min(MED_DOSE_MIN)
    .max(MED_DOSE_MAX)
    .nullable()
    .optional(),
} as const;

// Predicates exported so the form layer can reuse the exact invariants
// instead of re-deriving them.
export const startAtNotFuture = (v: { startAt?: Date }) =>
  v.startAt ? v.startAt.getTime() <= Date.now() : true;

export const endAfterStart = (v: { startAt?: Date; endAt?: Date | null }) => {
  if (!v.endAt || !v.startAt) return true;
  return v.endAt.getTime() > v.startAt.getTime();
};

export const durationWithinMax = (v: {
  startAt?: Date;
  endAt?: Date | null;
}) => {
  if (!v.endAt || !v.startAt) return true;
  return v.endAt.getTime() - v.startAt.getTime() <= MAX_FEEDING_DURATION_MS;
};

export const medicationInvariantFull = (v: {
  medicationId?: string | null;
  medicationDoseDrops?: number | null;
}) => {
  const hasId = v.medicationId != null;
  const hasDose = v.medicationDoseDrops != null;
  return hasId === hasDose;
};

export const medicationInvariantPatch = (v: {
  medicationId?: string | null;
  medicationDoseDrops?: number | null;
}) => {
  const idTouched = "medicationId" in v;
  const doseTouched = "medicationDoseDrops" in v;
  if (!idTouched && !doseTouched) return true;
  if (idTouched && doseTouched) {
    const hasId = v.medicationId != null;
    const hasDose = v.medicationDoseDrops != null;
    return hasId === hasDose;
  }
  return false;
};

export const feedingSchema = z
  .object(baseFeedingShape)
  .refine(startAtNotFuture, {
    message: "startAt must not be in the future",
    path: ["startAt"],
  })
  .refine(endAfterStart, {
    message: "endAt must be after startAt",
    path: ["endAt"],
  })
  .refine(durationWithinMax, {
    message: "duration must be ≤ 180 minutes",
    path: ["endAt"],
  })
  .refine(medicationInvariantFull, {
    message: "medicationDoseDrops must match medicationId presence",
    path: ["medicationDoseDrops"],
  });

export const feedingPatchSchema = z
  .object(baseFeedingShape)
  .partial()
  .refine(startAtNotFuture, {
    message: "startAt must not be in the future",
    path: ["startAt"],
  })
  .refine(endAfterStart, {
    message: "endAt must be after startAt",
    path: ["endAt"],
  })
  .refine(durationWithinMax, {
    message: "duration must be ≤ 180 minutes",
    path: ["endAt"],
  })
  .refine(medicationInvariantPatch, {
    message: "medicationDoseDrops must match medicationId presence",
    path: ["medicationDoseDrops"],
  });

export type FeedingInput = z.infer<typeof feedingSchema>;
export type FeedingCreate = FeedingInput;
export type FeedingPatchInput = z.infer<typeof feedingPatchSchema>;

export const feedingResponseSchema = z.object({
  _id: objectIdString,
  babyId: objectIdString,
  startAt: z.iso.datetime(),
  endAt: z.iso.datetime().nullable(),
  volumeMl: z.number().nullable(),
  isTopUp: z.boolean(),
  medicationId: objectIdString.nullable(),
  medicationDoseDrops: z.number().nullable(),
});

export type Feeding = z.infer<typeof feedingResponseSchema>;
