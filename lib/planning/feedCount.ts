/**
 * Возрастные диапазоны числа кормлений (PRD §6).
 *
 * neonatal (ageDays < 14): 8–12
 * 14–60 дн:                6–8
 * 61–120 дн:               5–6
 * 121–180 дн:              5–5
 */

/** Возрастной диапазон числа кормлений [min, max]. */
export function feedCountRange(ageDays: number): [number, number] {
  if (ageDays < 14) return [8, 12];
  if (ageDays <= 60) return [6, 8];
  if (ageDays <= 120) return [5, 6];
  return [5, 5];
}

/**
 * Рекомендуемый центр числа кормлений.
 * Использует baby.feedingsPerDay только если оно попадает внутрь возрастного
 * range; иначе — округлённый центр range (PRD §6, правило (a)).
 */
export function feedCountCenter(
  feedingsPerDay: number,
  range: [number, number],
): number {
  const [min, max] = range;
  if (feedingsPerDay >= min && feedingsPerDay <= max) {
    return feedingsPerDay;
  }
  return Math.round((min + max) / 2);
}
