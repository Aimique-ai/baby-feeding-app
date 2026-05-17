import "server-only";
import { Types } from "mongoose";
import { dbConnect } from "@/lib/mongodb";
import { FormulaModel } from "@/models/formula";
import { serializeFormula } from "./serializeFormula";
import type { SerializedBaby, SerializedFormula } from "./serializedTypes";

export type SerializedBabyWithFormula = SerializedBaby & {
  formula: SerializedFormula | null;
};

/**
 * Enriched-сериализация baby для /api/baby: один lookup активной смеси.
 * resolveActiveBaby не утяжеляется — этот хелпер используется только в
 * app/api/baby/route.ts (PRD §8).
 */
export async function serializeBabyWithFormula(
  baby: SerializedBaby,
): Promise<SerializedBabyWithFormula> {
  let formula: SerializedFormula | null = null;
  if (baby.currentFormulaId && Types.ObjectId.isValid(baby.currentFormulaId)) {
    await dbConnect();
    const doc = await FormulaModel.findById(baby.currentFormulaId).lean();
    if (doc) {
      formula = serializeFormula(
        doc as unknown as Parameters<typeof serializeFormula>[0],
      );
    }
  }
  return { ...baby, formula };
}
