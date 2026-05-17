import "server-only";
import { Types } from "mongoose";
import { FormulaModel } from "@/models/formula";

/**
 * Проверяет, что currentFormulaId (если задан и не null) ссылается на
 * существующую не-архивную Formula. Возвращает true, если значение
 * отсутствует/null или документ найден.
 */
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
