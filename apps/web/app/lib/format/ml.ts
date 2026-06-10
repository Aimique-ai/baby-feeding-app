export function fmtMl(v: number): string {
  return `${Math.round(v)} мл`;
}

export function roundMl(v: number): number {
  return Math.round(v);
}

export function round5(v: number): number {
  return Math.round(v / 5) * 5;
}

export function floor5(v: number): number {
  return Math.floor(v / 5) * 5;
}

export function round10(v: number): number {
  return Math.round(v / 10) * 10;
}

export function floor10(v: number): number {
  return Math.floor(v / 10) * 10;
}

export function ceil10(v: number): number {
  return Math.ceil(v / 10) * 10;
}
