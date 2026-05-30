import type { Baby } from "./baby";
import type { Feeding } from "./feeding";
import type { Weight } from "./weight";

// Plan-shaped deserialized aliases (consumed by @leon/domain planning types).
// Kept as distinct exports so the planning surface doesn't have to know about
// the Mongo serialization shape directly.

export type PlanFeeding = {
  _id: string;
  startAt: Date;
  endAt: Date | null;
  volumeMl: number | null;
  isTopUp: boolean;
};

export type PlanBaby = {
  birthDate: Date;
  birthWeightGrams: number;
};

export type PlanWeight = {
  date: Date;
  weightGrams: number;
};

export function deserializeFeeding(s: Feeding): PlanFeeding {
  return {
    _id: s._id,
    startAt: new Date(s.startAt),
    endAt: s.endAt ? new Date(s.endAt) : null,
    volumeMl: s.volumeMl,
    isTopUp: s.isTopUp,
  };
}

export function deserializeBaby(s: Baby): PlanBaby {
  return {
    birthDate: new Date(s.birthDate),
    birthWeightGrams: s.birthWeightGrams,
  };
}

export function deserializeWeight(s: Weight): PlanWeight {
  return {
    date: new Date(s.date),
    weightGrams: s.weightGrams,
  };
}
