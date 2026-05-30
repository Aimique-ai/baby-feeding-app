/** Age-based feed count range [min, max]. */
export function feedCountRange(ageDays: number): [number, number] {
  if (ageDays < 14) return [8, 12];
  if (ageDays <= 60) return [6, 8];
  if (ageDays <= 120) return [5, 6];
  return [5, 5];
}
