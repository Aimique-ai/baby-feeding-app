/**
 * Энергетическая кривая WHO/FAO/UNU для formula-fed детей (PRD §5.2).
 *
 * Узлы — средние значения ккал/кг/сут по месяцам. Мы трактуем их как
 * point-node узлы линейной интерполяции (продуктовое сглаживание): между
 * соседними месяцами значение интерполируется линейно, на краях — clamp.
 *
 * Скоуп — 0..6 мес. Полная таблица research уходит до 11 мес; узлы за 5 мес
 * оставлены закомментированными как архитектурный шов (PRD §9) и НЕ используются.
 * Источник: https://www.fao.org/3/Y5686E/y5686e05.htm
 */

const MONTH_NODES = [0, 1, 2, 3, 4, 5];
const KCALKG_NODES = [120, 109, 100, 87, 86, 84];

// Шов для прикорм-задачи (6–11 мес) — НЕ использовать в этой итерации:
// const MONTH_NODES_EXT  = [6, 7, 8, 9, 10, 11];
// const KCALKG_NODES_EXT = [82, 83, 82, 83, 82, 81];

const DAYS_PER_MONTH = 30.4375;

/** Возраст в месяцах из возраста в днях (PRD §5.2). */
export function ageMonthsFromDays(ageDays: number): number {
  return ageDays / DAYS_PER_MONTH;
}

/**
 * Целевая энергия ккал/кг/сут для возраста в месяцах.
 * Линейная интерполяция между узлами, clamp на краях скоупа.
 */
export function targetKcalPerKg(ageMonths: number): number {
  const first = MONTH_NODES[0];
  const last = MONTH_NODES[MONTH_NODES.length - 1];

  if (ageMonths <= first) return KCALKG_NODES[0];
  if (ageMonths >= last) return KCALKG_NODES[KCALKG_NODES.length - 1];

  for (let i = 0; i < MONTH_NODES.length - 1; i++) {
    const lo = MONTH_NODES[i];
    const hi = MONTH_NODES[i + 1];
    if (ageMonths >= lo && ageMonths <= hi) {
      const t = (ageMonths - lo) / (hi - lo);
      return KCALKG_NODES[i] + (KCALKG_NODES[i + 1] - KCALKG_NODES[i]) * t;
    }
  }

  // Недостижимо: clamp выше покрывает края.
  return KCALKG_NODES[KCALKG_NODES.length - 1];
}
