import "server-only";
import { Types } from "mongoose";
import { dbConnect } from "@/lib/mongodb";
import { FeedingModel } from "@/models/feeding";
import { WeightModel } from "@/models/weight";
import { dayRangeUtc } from "@/lib/time/dayRange";
import type {
  SerializedFeeding,
  SerializedWeight,
} from "./serializedTypes";

type FeedingDocLike = {
  _id: { toString(): string };
  babyId: { toString(): string };
  startAt: Date;
  endAt: Date | null;
  volumeMl: number | null;
  isTopUp: boolean;
  medicationId: { toString(): string } | null;
  medicationDoseDrops: number | null;
};

export function serializeFeeding(doc: FeedingDocLike): SerializedFeeding {
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
};

export function serializeWeight(doc: WeightDocLike): SerializedWeight {
  return {
    _id: doc._id.toString(),
    babyId: doc.babyId.toString(),
    date: doc.date.toISOString(),
    weightGrams: doc.weightGrams,
  };
}

export async function fetchFeedingsForDay(
  dateISO: string,
  tz: string,
  babyId: string,
): Promise<SerializedFeeding[]> {
  await dbConnect();
  const { gte, lt } = dayRangeUtc(dateISO, tz);
  const docs = await FeedingModel.find({
    babyId: new Types.ObjectId(babyId),
    startAt: { $gte: gte, $lt: lt },
  })
    .sort({ startAt: 1 })
    .lean();
  return (docs as unknown as Parameters<typeof serializeFeeding>[0][]).map(
    serializeFeeding,
  );
}

/**
 * Last 5 feedings of ANY type strictly before `iso`, newest first.
 * The planning layer (`runPipeline`) classifies which of them is "main-like"
 * — it knows `portionMin`, so `portionMin` never enters the Mongo query
 * (Q-D2 variant 3).
 */
export async function fetchLastFeedingBefore(
  iso: Date,
  babyId: string,
): Promise<SerializedFeeding[]> {
  await dbConnect();
  const docs = await FeedingModel.find({
    babyId: new Types.ObjectId(babyId),
    startAt: { $lt: iso },
  })
    .sort({ startAt: -1 })
    .limit(5)
    .lean();
  return (docs as unknown as Parameters<typeof serializeFeeding>[0][]).map(
    serializeFeeding,
  );
}

export async function fetchWeights(babyId: string): Promise<SerializedWeight[]> {
  await dbConnect();
  const docs = await WeightModel.find({
    babyId: new Types.ObjectId(babyId),
  })
    .sort({ date: 1 })
    .lean();
  return (docs as unknown as WeightDocLike[]).map(serializeWeight);
}
