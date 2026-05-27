import { Types } from "mongoose";
import type {
  SerializedBaby,
  SerializedFormula,
} from "@leon/contracts/serialized";
import { dbConnect } from "../db/mongo.js";
import { FormulaModel } from "../models/formula.js";
import { serializeFormula } from "./serializeFormula.js";

export type SerializedBabyWithFormula = SerializedBaby & {
  formula: SerializedFormula | null;
};

export async function serializeBabyWithFormula(
  baby: SerializedBaby,
): Promise<SerializedBabyWithFormula> {
  let formula: SerializedFormula | null = null;
  if (baby.currentFormulaId && Types.ObjectId.isValid(baby.currentFormulaId)) {
    await dbConnect();
    const doc = await FormulaModel.findById(baby.currentFormulaId).lean();
    if (doc) {
      formula = serializeFormula(doc);
    }
  }
  return { ...baby, formula };
}
