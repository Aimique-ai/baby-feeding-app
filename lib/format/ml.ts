/**
 * Display rounding for ml. Math is float; rounding happens at the display
 * boundary. Half-up (Math.round semantics with explicit handling for 0.5).
 */
export function fmtMl(v: number): string {
  return `${Math.round(v)} мл`;
}

export function roundMl(v: number): number {
  return Math.round(v);
}
