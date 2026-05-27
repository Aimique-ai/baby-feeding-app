import type { SerializedBaby } from "@leon/contracts/serialized";

// Structural shape compatible with `BabyModel.find().lean()` results. Optional
// fields are typed `T | null | undefined` so a raw lean doc satisfies the shape
// without casts; the function normalizes everything to `T | null` on the way out.
type BabyDocLike = {
  _id: { toString(): string };
  name: string;
  birthDate: Date;
  birthWeightGrams: number;
  sex?: "male" | "female";
  currentFormulaId?: { toString(): string } | null;
  preferredFeedCount?: number | null;
  archivedAt?: Date | null;
};

export function serializeBaby(doc: BabyDocLike): SerializedBaby {
  return {
    _id: doc._id.toString(),
    name: doc.name,
    birthDate: doc.birthDate.toISOString(),
    birthWeightGrams: doc.birthWeightGrams,
    sex: doc.sex ?? "male",
    currentFormulaId: doc.currentFormulaId
      ? doc.currentFormulaId.toString()
      : null,
    preferredFeedCount: doc.preferredFeedCount ?? null,
    archivedAt: doc.archivedAt ? doc.archivedAt.toISOString() : null,
  };
}
