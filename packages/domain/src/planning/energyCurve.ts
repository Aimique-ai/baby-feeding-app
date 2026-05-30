/**
 * Nodes of the age curve "target energy kcal/kg/day" for the energy mode.
 *
 * Source: FAO/WHO/UNU 2004, Human Energy Requirements, Table 3.3 —
 * "Energy requirements of formula-fed infants" (mean of boys+girls).
 *   1 mo → 120 kcal/kg
 *   2 mo → 109 kcal/kg
 *   3 mo → 100 kcal/kg
 *   4 mo →  87 kcal/kg
 *   5 mo →  86 kcal/kg
 *   6 mo →  84 kcal/kg
 *
 * This app is exclusively about formula feeding, so we use the formula-fed
 * curve, not breastfed (TEE for formula-fed is 7–12% higher in the first
 * half-year — FAO 2004, ch. 3).
 *
 * Interpolation between nodes reconstructs the continuous FAO curve; the
 * nodes are FAO/WHO/UNU 2004 formula-fed values pinned to the midpoints of
 * the monthly intervals. The "0 mo" node = 120 is the plateau before 1 mo.
 *
 * After 6 mo — plateau of 84 kcal/kg: FAO gives similar values up to 12 mo
 * (~79–84 kcal/kg), and the app barely covers the target group older than
 * six months (complementary foods begin, formula stops being the main food).
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
