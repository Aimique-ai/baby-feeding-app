import { Types } from "mongoose";
import type { Baby, BabyWithFormula } from "@leon/schemas/baby";
import type { Formula } from "@leon/schemas/formula";
import { dbConnect } from "../db/mongo.js";
import { FormulaModel } from "../models/formula.js";
import { serializeFormula } from "./serializeFormula.js";

export async function serializeBabyWithFormula(
  baby: Baby,
): Promise<BabyWithFormula> {
  let formula: Formula | null = null;
  if (baby.currentFormulaId && Types.ObjectId.isValid(baby.currentFormulaId)) {
    await dbConnect();
    const doc = await FormulaModel.findById(baby.currentFormulaId).lean();
    if (doc) {
      formula = serializeFormula(doc);
    }
  }
  return { ...baby, formula };
}
