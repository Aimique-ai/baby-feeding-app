import { z } from "zod";
import {
  FEEDING_DURATION_MAX_MIN,
  FEEDING_VOLUME_MAX,
} from "@/lib/schemas/constants";

const objectIdString = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "invalid ObjectId");

// medication <-> dose invariant on FORM-shaped fields. Mirrors server
// `medicationInvariantFull` (hasId === hasDose). "" and null both count as "no dose".
const medicationInvariantForm = (v: {
  medicationId?: string | null;
  medDoseDrops?: number | "" | null;
}) => {
  const hasId = v.medicationId != null;
  const hasDose = v.medDoseDrops != null && v.medDoseDrops !== "";
  return hasId === hasDose;
};

// startAt must not be in the future (mirrors server startAtNotFuture).
const startAtNotFuture = (v: { startAt: Date }) =>
  v.startAt.getTime() <= Date.now();

export const feedingFormSchema = z
  .object({
    startAt: z.date(),
    // duration "" is VALID -> means "no endAt". BARE union, no .refine, no .pipe:
    // gives z.input === z.output === number | "". The .max() is enforced at parse time.
    durationMin: z.union([
      z.literal(""),
      z.number().int().min(0).max(FEEDING_DURATION_MAX_MIN),
    ]),
    volumeMl: z
      .union([z.literal(""), z.number()])
      .refine((v) => v !== "", { message: "Объём обязателен" })
      .pipe(z.number().positive().max(FEEDING_VOLUME_MAX)),
    // ^ .positive() (NOT .min(0)) — preserves current UI rejecting volume 0.
    isTopUp: z.boolean(), // plain boolean, no .default() — defaultValues always supplies it
    medicationId: z.union([objectIdString, z.null()]),
    medDoseDrops: z.union([z.literal(""), z.number(), z.null()]),
  })
  .refine(startAtNotFuture, {
    message: "Время в будущем",
    path: ["startAt"],
  })
  .refine(medicationInvariantForm, {
    message: "Доза должна соответствовать выбранному лекарству",
    path: ["medDoseDrops"],
  });

export type FeedingFormValues = z.input<typeof feedingFormSchema>;
export type FeedingFormOut = z.output<typeof feedingFormSchema>;

export type FeedingApiBody = {
  startAt: Date;
  endAt: Date | null;
  volumeMl: number;
  isTopUp: boolean;
  medicationId: string | null;
  medicationDoseDrops: number | null;
};

// Form -> API. Pure. The durationMin<->endAt conversion lives HERE (Decision #3),
// NOT in a Zod .transform().
export function toFeedingApiBody(v: FeedingFormOut): FeedingApiBody {
  // durationMin "" or 0 -> no endAt. Otherwise endAt = startAt + durationMin minutes.
  const endAt =
    v.durationMin !== "" && v.durationMin > 0
      ? new Date(v.startAt.getTime() + v.durationMin * 60_000)
      : null;
  return {
    startAt: v.startAt,
    endAt,
    volumeMl: v.volumeMl,
    isTopUp: v.isTopUp,
    medicationId: v.medicationId,
    // "" (transient empty) and null both serialize to null
    medicationDoseDrops:
      v.medDoseDrops === "" || v.medDoseDrops == null ? null : v.medDoseDrops,
  };
}
