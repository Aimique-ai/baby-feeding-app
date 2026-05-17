import "server-only";
import { cookies } from "next/headers";
import { Types } from "mongoose";
import { dbConnect } from "@/lib/mongodb";
import { BabyModel } from "@/models/baby";
import type { SerializedBaby } from "./serializedTypes";

const COOKIE_NAME = "activeBabyId";

type BabyDocLike = {
  _id: { toString(): string };
  name: string;
  birthDate: Date;
  birthWeightGrams: number;
  feedingsPerDay: number;
  sex?: "male" | "female";
  currentFormulaId?: { toString(): string } | null;
  archivedAt: Date | null;
};

export function serializeBaby(doc: BabyDocLike): SerializedBaby {
  return {
    _id: doc._id.toString(),
    name: doc.name,
    birthDate: doc.birthDate.toISOString(),
    birthWeightGrams: doc.birthWeightGrams,
    feedingsPerDay: doc.feedingsPerDay,
    sex: doc.sex ?? "male",
    currentFormulaId: doc.currentFormulaId
      ? doc.currentFormulaId.toString()
      : null,
    archivedAt: doc.archivedAt ? doc.archivedAt.toISOString() : null,
  };
}

export async function getActiveBabyIdFromCookie(): Promise<string | null> {
  const c = await cookies();
  const v = c.get(COOKIE_NAME)?.value;
  if (!v || !Types.ObjectId.isValid(v)) return null;
  return v;
}

export type ActiveBabyResult = {
  baby: SerializedBaby;
  source: "cookie" | "fallback";
};

/**
 * Resolve the active baby for this request:
 *  1. If cookie points to an existing, non-archived baby → use it.
 *  2. Otherwise, fall back to the first non-archived baby by createdAt.
 *  3. If none exist, return null.
 */
export async function resolveActiveBaby(): Promise<ActiveBabyResult | null> {
  await dbConnect();
  const cookieId = await getActiveBabyIdFromCookie();
  if (cookieId) {
    const doc = (await BabyModel.findOne({
      _id: new Types.ObjectId(cookieId),
      archivedAt: null,
    }).lean()) as BabyDocLike | null;
    if (doc) return { baby: serializeBaby(doc), source: "cookie" };
  }
  const fallback = (await BabyModel.findOne({ archivedAt: null })
    .sort({ createdAt: 1 })
    .lean()) as BabyDocLike | null;
  if (fallback) return { baby: serializeBaby(fallback), source: "fallback" };
  return null;
}
