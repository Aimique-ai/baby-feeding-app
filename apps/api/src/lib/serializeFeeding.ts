import type { Feeding } from "@leon/schemas/feeding";
import type { Weight } from "@leon/schemas/weight";
import type { Medication } from "@leon/schemas/medication";

// Structural shapes compatible with `.lean()` results. Optional/nullable fields
// allow `undefined` so raw docs satisfy the shape without casts; the functions
// normalize to `T | null` on the way out.
type FeedingDocLike = {
  _id: { toString(): string };
  babyId: { toString(): string };
  startAt: Date;
  endAt?: Date | null;
  volumeMl?: number | null;
  isTopUp: boolean;
  medicationId?: { toString(): string } | null;
  medicationDoseDrops?: number | null;
};

export function serializeFeeding(doc: FeedingDocLike): Feeding {
  return {
    _id: doc._id.toString(),
    babyId: doc.babyId.toString(),
    startAt: doc.startAt.toISOString(),
    endAt: doc.endAt ? doc.endAt.toISOString() : null,
    volumeMl: doc.volumeMl ?? null,
    isTopUp: !!doc.isTopUp,
    medicationId: doc.medicationId ? doc.medicationId.toString() : null,
    medicationDoseDrops: doc.medicationDoseDrops ?? null,
  };
}

type WeightDocLike = {
  _id: { toString(): string };
  babyId: { toString(): string };
  date: Date;
  weightGrams: number;
  // tolerate Mongoose timestamps even though we don't surface them
  createdAt?: Date;
  updatedAt?: Date;
};

export function serializeWeight(doc: WeightDocLike): Weight {
  return {
    _id: doc._id.toString(),
    babyId: doc.babyId.toString(),
    date: doc.date.toISOString(),
    weightGrams: doc.weightGrams,
  };
}

type MedicationDocLike = {
  _id: { toString(): string };
  babyId: { toString(): string };
  name: string;
  defaultDoseDrops: number;
  deletedAt?: Date | null;
  createdAt: Date;
};

export function serializeMedication(doc: MedicationDocLike): Medication {
  return {
    _id: doc._id.toString(),
    babyId: doc.babyId.toString(),
    name: doc.name,
    defaultDoseDrops: doc.defaultDoseDrops,
    deletedAt: doc.deletedAt ? doc.deletedAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
  };
}
