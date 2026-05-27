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

/** Округление к ближайшему кратному 5 (для mlPerFeed). */
export function round5(v: number): number {
  return Math.round(v / 5) * 5;
}

/** Округление вниз к кратному 5 (для распределения объёмов слотов). */
export function floor5(v: number): number {
  return Math.floor(v / 5) * 5;
}

/** Округление к ближайшему кратному 10 (для dailyMl). */
export function round10(v: number): number {
  return Math.round(v / 10) * 10;
}

/** Округление вниз к кратному 10 (outward — нижняя граница коридора). */
export function floor10(v: number): number {
  return Math.floor(v / 10) * 10;
}

/** Округление вверх к кратному 10 (outward — верхняя граница коридора). */
export function ceil10(v: number): number {
  return Math.ceil(v / 10) * 10;
}
