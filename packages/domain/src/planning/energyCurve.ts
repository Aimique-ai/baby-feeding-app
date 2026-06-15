/**
 * Nodes of the age curve "target energy kcal/kg/day" for the energy mode,
 * split by sex.
 *
 * Source: FAO/WHO/UNU 2004, Human Energy Requirements, Table 3.3 —
 * "Energy requirements of formula-fed infants", boys/girls columns:
 *           boys   girls
 *   1 mo →  122     117
 *   2 mo →  110     108
 *   3 mo →  100     101
 *   4 mo →   86      89
 *   5 mo →   85      87
 *   6 mo →   83      85
 *
 * The per-kg difference is small (≤5 kcal/kg) and reverses sign: boys are
 * higher in months 1–2, girls in months 4–6. It reflects differing weight
 * trajectories, not different per-kg metabolism — so part of it is already
 * captured downstream via the actual weight (dailyKcal = weightKg · kcalKg).
 *
 * This app is exclusively about formula feeding, so we use the formula-fed
 * curve, not breastfed (TEE for formula-fed is 7–12% higher in the first
 * half-year — FAO 2004, ch. 3).
 *
 * Interpolation between nodes reconstructs the continuous FAO curve. The
 * "0 mo" node duplicates the 1 mo value as the plateau before 1 mo.
 *
 * After 6 mo — plateau of the 6 mo value: FAO gives similar values up to
 * 12 mo (~79–84 kcal/kg), and the app barely covers the target group older
 * than six months (complementary foods begin, formula stops being the main
 * food).
 *
 * https://www.fao.org/4/y5686e/y5686e05.htm
 * https://pmc.ncbi.nlm.nih.gov/articles/PMC8575726/
 */
const MONTH_NODES = [0, 1, 2, 3, 4, 5, 6];
const BOYS_KCALKG = [122, 122, 110, 100, 86, 85, 83];
const GIRLS_KCALKG = [117, 117, 108, 101, 89, 87, 85];

const DAYS_PER_MONTH = 30.4375;

export function ageMonthsFromDays(ageDays: number): number {
  return ageDays / DAYS_PER_MONTH;
}

export function targetKcalPerKg(
  ageMonths: number,
  sex: "male" | "female",
): number {
  const nodes = sex === "female" ? GIRLS_KCALKG : BOYS_KCALKG;
  const first = MONTH_NODES[0];
  const last = MONTH_NODES[MONTH_NODES.length - 1];

  if (ageMonths <= first) return nodes[0];
  if (ageMonths >= last) return nodes[nodes.length - 1];

  for (let i = 0; i < MONTH_NODES.length - 1; i++) {
    const lo = MONTH_NODES[i];
    const hi = MONTH_NODES[i + 1];
    if (ageMonths >= lo && ageMonths <= hi) {
      const t = (ageMonths - lo) / (hi - lo);
      return nodes[i] + (nodes[i + 1] - nodes[i]) * t;
    }
  }

  return nodes[nodes.length - 1];
}
