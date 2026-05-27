/**
 * Узлы возрастной кривой "целевая калорийность ккал/кг/сут" для энергорежима.
 *
 * Источник: FAO/WHO/UNU 2004, Human Energy Requirements, Table 3.3 —
 * "Energy requirements of formula-fed infants" (mean по boys+girls).
 *   1 мес → 120 ккал/кг
 *   2 мес → 109 ккал/кг
 *   3 мес → 100 ккал/кг
 *   4 мес →  87 ккал/кг
 *   5 мес →  86 ккал/кг
 *   6 мес →  84 ккал/кг
 *
 * Это приложение исключительно про искусственное вскармливание, поэтому
 * берём именно formula-fed-кривую, а не breastfed (TEE у formula-fed
 * выше на 7–12% в первом полугодии — FAO 2004, гл. 3).
 *
 * Узел "0 мес" задан = 120 (плато до 1 мес) намеренно — чтобы на стыке с
 * неонатальным режимом (`neonatal.ts`, день 14) не было скачка объёма:
 *   неонатал на 14 день ≈ 178 мл/кг (= weight × 180 при t≈0.93)
 *   энерго на 14 день при kcalKg=120 и 67 ккал/100мл ≈ 179 мл/кг
 * Любое снижение узла 0 ниже 120 ломает эту согласованность.
 *
 * После 6 мес — плато 84 ккал/кг: FAO даёт схожие значения до 12 мес
 * (~79–84 ккал/кг), и приложение целевую группу старше полугода почти
 * не покрывает (вводится прикорм, смесь перестаёт быть основной едой).
 *
 * https://www.fao.org/4/y5686e/y5686e05.htm
 * https://pmc.ncbi.nlm.nih.gov/articles/PMC8575726/
 */
const MONTH_NODES = [0, 1, 2, 3, 4, 5, 6];
const KCALKG_NODES = [120, 120, 109, 100, 87, 86, 84];

const DAYS_PER_MONTH = 30.4375;

export function ageMonthsFromDays(ageDays: number): number {
  return ageDays / DAYS_PER_MONTH;
}

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

  return KCALKG_NODES[KCALKG_NODES.length - 1];
}
