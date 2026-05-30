/** Round to nearest multiple of 5 (for mlPerFeed). */
export function round5(v: number): number {
  return Math.round(v / 5) * 5;
}

export function floor5(v: number): number {
  return Math.floor(v / 5) * 5;
}

/** Round to nearest multiple of 10 (for dailyMl). */
export function round10(v: number): number {
  return Math.round(v / 10) * 10;
}

/** Round down to multiple of 10 — lower corridor boundary. */
export function floor10(v: number): number {
  return Math.floor(v / 10) * 10;
}

/** Round up to multiple of 10 — upper corridor boundary. */
export function ceil10(v: number): number {
  return Math.ceil(v / 10) * 10;
}

export function roundMl(v: number): number {
  return Math.round(v);
}
