const NEO_DAY0_ML_PER_KG = 70;
const NEO_WINDOW_DAYS = 14;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

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
