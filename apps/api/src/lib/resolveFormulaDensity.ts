import { Types } from "mongoose";
import { DEFAULT_FORMULA_DENSITY } from "@leon/domain/planning/target";
import type { FormulaDensity } from "@leon/domain/planning/types";
import { dbConnect } from "../db/mongo.js";
import { FormulaModel } from "../models/formula.js";

export async function resolveFormulaDensity(
  currentFormulaId: string | Types.ObjectId | null | undefined,
): Promise<FormulaDensity> {
  if (!currentFormulaId) return DEFAULT_FORMULA_DENSITY;
  const id = currentFormulaId.toString();
  if (!Types.ObjectId.isValid(id)) return DEFAULT_FORMULA_DENSITY;
  await dbConnect();
  const doc = (await FormulaModel.findById(id)
    .select("kcalPer100mlReady proteinGPer100kcal")
    .lean()) as {
    kcalPer100mlReady: number;
    proteinGPer100kcal: number | null;
  } | null;
  if (!doc) return DEFAULT_FORMULA_DENSITY;
  return {
    kcalPer100ml: doc.kcalPer100mlReady,
    proteinGPer100kcal: doc.proteinGPer100kcal,
  };
}
