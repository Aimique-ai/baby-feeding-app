import "server-only";
import { Types } from "mongoose";
import { dbConnect } from "@/lib/mongodb";
import { FormulaModel } from "@/models/formula";
import { DEFAULT_FORMULA_DENSITY } from "@/lib/planning/target";
import type { FormulaDensity } from "@/lib/planning/types";

/**
 * Резолвит активную смесь ребёнка в энергоплотность для движка планирования.
 * Если id нет или документ не найден — дефолт {kcalPer100ml:67, proteinGPer100kcal:null}.
 */
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
