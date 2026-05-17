import type { SerializedFormula } from "./serializedTypes";

type FormulaDocLike = {
  _id: { toString(): string };
  name: string;
  brand?: string | null;
  kcalPer100mlReady: number;
  proteinGPer100kcal: number;
  proteinGPer100mlReady?: number | null;
  stage?: number | null;
  kind?: "standard";
  isSystem?: boolean;
  archivedAt?: Date | null;
};

export function serializeFormula(doc: FormulaDocLike): SerializedFormula {
  return {
    _id: doc._id.toString(),
    name: doc.name,
    brand: doc.brand ?? null,
    kcalPer100mlReady: doc.kcalPer100mlReady,
    proteinGPer100kcal: doc.proteinGPer100kcal,
    proteinGPer100mlReady: doc.proteinGPer100mlReady ?? null,
    stage: doc.stage ?? 1,
    kind: doc.kind ?? "standard",
    isSystem: doc.isSystem ?? false,
    archivedAt: doc.archivedAt ? doc.archivedAt.toISOString() : null,
  };
}
