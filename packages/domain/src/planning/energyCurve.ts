const MONTH_NODES = [0, 1, 2, 3, 4, 5];
const KCALKG_NODES = [120, 109, 100, 87, 86, 84];

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
