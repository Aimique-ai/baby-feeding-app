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

/** Round to nearest multiple of 5 (for mlPerFeed). */
export function round5(v: number): number {
  return Math.round(v / 5) * 5;
}

/** Round down to multiple of 5 (for distributing slot volumes). */
export function floor5(v: number): number {
  return Math.floor(v / 5) * 5;
}

/** Round to nearest multiple of 10 (for dailyMl). */
export function round10(v: number): number {
  return Math.round(v / 10) * 10;
}

/** Round down to multiple of 10 (outward — corridor lower bound). */
export function floor10(v: number): number {
  return Math.floor(v / 10) * 10;
}

/** Round up to multiple of 10 (outward — corridor upper bound). */
export function ceil10(v: number): number {
  return Math.ceil(v / 10) * 10;
}
