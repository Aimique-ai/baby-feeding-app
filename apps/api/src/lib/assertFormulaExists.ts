import { Types } from "mongoose";
import { FormulaModel } from "../models/formula.js";

export async function formulaExists(
  currentFormulaId: string | null | undefined,
): Promise<boolean> {
  if (!currentFormulaId) return true;
  if (!Types.ObjectId.isValid(currentFormulaId)) return false;
  const doc = await FormulaModel.exists({
    _id: new Types.ObjectId(currentFormulaId),
    archivedAt: null,
  });
  return doc !== null;
}
