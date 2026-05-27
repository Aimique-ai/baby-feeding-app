/** Округление к ближайшему кратному 5 (для mlPerFeed). */
export function round5(v: number): number {
  return Math.round(v / 5) * 5;
}

/** Округление вниз к кратному 5. */
export function floor5(v: number): number {
  return Math.floor(v / 5) * 5;
}

/** Округление к ближайшему кратному 10 (для dailyMl). */
export function round10(v: number): number {
  return Math.round(v / 10) * 10;
}

/** Округление вниз к кратному 10 — нижняя граница коридора. */
export function floor10(v: number): number {
  return Math.floor(v / 10) * 10;
}

/** Округление вверх к кратному 10 — верхняя граница коридора. */
export function ceil10(v: number): number {
  return Math.ceil(v / 10) * 10;
}

export function roundMl(v: number): number {
  return Math.round(v);
}
