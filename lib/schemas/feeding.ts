import { z } from "zod";

const SIXTY_MIN_MS = 60 * 60 * 1000;

const objectIdString = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "invalid ObjectId");

const baseFeedingShape = {
  babyId: objectIdString.optional(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date().nullable().optional(),
  volumeMl: z.number().min(0).max(200),
  isTopUp: z.boolean().default(false),
  parentFeedingId: objectIdString.nullable().optional(),
  medicationId: objectIdString.nullable().optional(),
  medicationDoseDrops: z.number().int().min(1).max(100).nullable().optional(),
} as const;

const startAtNotFuture = (v: { startAt?: Date }) =>
  v.startAt ? v.startAt.getTime() <= Date.now() : true;

const endAfterStart = (v: { startAt?: Date; endAt?: Date | null }) => {
  if (!v.endAt || !v.startAt) return true;
  return v.endAt.getTime() > v.startAt.getTime();
};

const durationWithinHour = (v: { startAt?: Date; endAt?: Date | null }) => {
  if (!v.endAt || !v.startAt) return true;
  return v.endAt.getTime() - v.startAt.getTime() <= SIXTY_MIN_MS;
};

const medicationInvariantFull = (v: {
  medicationId?: string | null;
  medicationDoseDrops?: number | null;
}) => {
  const hasId = v.medicationId != null;
  const hasDose = v.medicationDoseDrops != null;
  return hasId === hasDose;
};

const medicationInvariantPatch = (v: {
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
  .refine(durationWithinHour, {
    message: "duration must be ≤ 60 minutes",
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
  .refine(durationWithinHour, {
    message: "duration must be ≤ 60 minutes",
    path: ["endAt"],
  })
  .refine(medicationInvariantPatch, {
    message: "medicationDoseDrops must match medicationId presence",
    path: ["medicationDoseDrops"],
  });

export type FeedingInput = z.infer<typeof feedingSchema>;
export type FeedingPatchInput = z.infer<typeof feedingPatchSchema>;
