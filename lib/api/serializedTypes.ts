import type {
  Baby as PlanBaby,
  Feeding as PlanFeeding,
  Weight as PlanWeight,
} from "@/lib/planning/types";

export type SerializedFeeding = {
  _id: string;
  babyId: string;
  startAt: string;
  endAt: string | null;
  volumeMl: number | null;
  isTopUp: boolean;
  medicationId: string | null;
  medicationDoseDrops: number | null;
};

export type SerializedBaby = {
  _id: string;
  name: string;
  birthDate: string;
  birthWeightGrams: number;
  sex: "male" | "female";
  currentFormulaId: string | null;
  archivedAt: string | null;
};

export type SerializedFormula = {
  _id: string;
  name: string;
  brand: string | null;
  kcalPer100mlReady: number;
  proteinGPer100kcal: number;
  proteinGPer100mlReady: number | null;
  stage: number;
  kind: "standard";
  isSystem: boolean;
  archivedAt: string | null;
};

export type SerializedWeight = {
  _id: string;
  babyId: string;
  date: string;
  weightGrams: number;
};

export type SerializedMedication = {
  _id: string;
  babyId: string;
  name: string;
  defaultDoseDrops: number;
  deletedAt: string | null;
  createdAt: string;
};

export function deserializeFeeding(s: SerializedFeeding): PlanFeeding {
  return {
    _id: s._id,
    startAt: new Date(s.startAt),
    endAt: s.endAt ? new Date(s.endAt) : null,
    volumeMl: s.volumeMl,
    isTopUp: s.isTopUp,
  };
}

export function deserializeBaby(s: SerializedBaby): PlanBaby {
  return {
    birthDate: new Date(s.birthDate),
    birthWeightGrams: s.birthWeightGrams,
  };
}

export function deserializeWeight(s: SerializedWeight): PlanWeight {
  return {
    date: new Date(s.date),
    weightGrams: s.weightGrams,
  };
}

export function deserializeMedication(
  s: SerializedMedication,
): SerializedMedication {
  return s;
}

export function deserializeFormula(s: SerializedFormula): SerializedFormula {
  return s;
}
