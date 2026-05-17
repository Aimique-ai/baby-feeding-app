/**
 * Неонатальный режим — линейная титрация суточного объёма (PRD §5.3).
 *
 * Активен для ageDays 0..13 (дни жизни 1..14). Чистая линейная интерполяция
 * между масса-относительным якорём дня 0 и клиническим ориентиром дня 14.
 * НЕ стыкуется с энергетической кривой — намеренно (см. PRD §5.3).
 */

const NEO_DAY0_ML_PER_KG = 70; // стартовый суточный объём ~70 мл/кг (масса при рождении)
const NEO_WINDOW_DAYS = 14; // длина окна линейной титрации

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Суточный объём (мл) в неонатальном режиме.
 * @param birthWeightKg масса при рождении, кг
 * @param weightKg текущая масса, кг
 * @param ageDays возраст в днях, 0..13
 */
export function neonatalDailyMl(
  birthWeightKg: number,
  weightKg: number,
  ageDays: number,
): number {
  const day0Anchor = birthWeightKg * NEO_DAY0_ML_PER_KG;
  const base = clamp(weightKg * 180, weightKg * 150, weightKg * 200);
  const t = ageDays / NEO_WINDOW_DAYS;
  return day0Anchor + (base - day0Anchor) * t;
}
