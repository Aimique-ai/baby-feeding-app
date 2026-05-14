import type { Baby } from "./types";

/**
 * Стратегии расчёта суточной цели для дня жизни ≥ 11 (PRD §4.1, "зрелая стадия").
 * Дни 1–10 (Зайцева) обрабатываются в computeTarget напрямую и под реестр не попадают.
 *
 * Активная формула выбирается через ACTIVE_MATURE_FORMULA_ID. Точка переключения
 * остаётся одной — позже её заменит baby.dailyFormulaId без изменения сигнатур.
 */

export type MatureFormulaId = "volumetric" | "rounded-plus-200";

export interface MatureFormulaCtx {
  baby: Baby;
  latestWeightGrams: number;
  /** День жизни ребёнка для D (PRD §2.2). Для возрастных формул обязателен. */
  dayOfLife: number;
}

export interface MatureFormula {
  id: MatureFormulaId;
  label: string;
  compute: (ctx: MatureFormulaCtx) => number;
}

/**
 * Объёмный метод. Доля массы тела зависит от возраста:
 *   день 11..60   (~2 нед – 2 мес):  1/5 массы, потолок 1000 мл
 *   день 61..120  (~2 – 4 мес):       1/6 массы, потолок 1000 мл
 *   день 121..180 (~4 – 6 мес):       1/7 массы, потолок 1000 мл (1-е полугодие)
 *   день 181+     (~6 – 12 мес):      1/8 массы, потолок 1100 мл (2-е полугодие)
 *
 * Месяц приближаем 30 днями — у нас уже есть dayOfLife, второй календарь не нужен.
 * Потолок применяется как min(weight/divisor, cap), чтобы перерасчёт по большому
 * весу не уехал за рекомендуемые верхние границы.
 */
function volumetricCompute({
  latestWeightGrams,
  dayOfLife,
}: MatureFormulaCtx): number {
  const { divisor, cap } = volumetricParamsForDay(dayOfLife);
  return Math.min(latestWeightGrams / divisor, cap);
}

export function volumetricParamsForDay(dayOfLife: number): {
  divisor: number;
  cap: number;
} {
  if (dayOfLife <= 60) return { divisor: 5, cap: 1000 };
  if (dayOfLife <= 120) return { divisor: 6, cap: 1000 };
  if (dayOfLife <= 180) return { divisor: 7, cap: 1000 };
  return { divisor: 8, cap: 1100 };
}

export const MATURE_FORMULAS: Record<MatureFormulaId, MatureFormula> = {
  volumetric: {
    id: "volumetric",
    label: "Объёмный метод (доля массы по возрасту)",
    compute: volumetricCompute,
  },
  "rounded-plus-200": {
    id: "rounded-plus-200",
    label: "Округление до 100 г, ÷10, +200",
    compute: ({ latestWeightGrams }) =>
      Math.round(latestWeightGrams / 100) * 10 + 200,
  },
};

export const ACTIVE_MATURE_FORMULA_ID: MatureFormulaId = "volumetric";
