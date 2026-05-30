export type LMS = { L: number; M: number; S: number };

export function zFromMeasurement(x: number, lms: LMS): number {
  const { L, M, S } = lms;
  if (L === 0) return Math.log(x / M) / S;
  return (Math.pow(x / M, L) - 1) / (L * S);
}

export function measurementFromZ(z: number, lms: LMS): number {
  const { L, M, S } = lms;
  if (L === 0) return M * Math.exp(z * S);
  return M * Math.pow(1 + L * S * z, 1 / L);
}

export function percentileFromZ(z: number): number {
  const sign = z >= 0 ? 1 : -1;
  const ax = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-ax * ax);
  return ((1 + sign * y) / 2) * 100;
}

export function zFromPercentile(p: number): number {
  const u = p / 100;
  if (u <= 0 || u >= 1) return u <= 0 ? -Infinity : Infinity;
  const a = [
    -39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269,
    -30.66479806614716, 2.506628277459239,
  ];
  const b = [
    -54.47609879822406, 161.5858368580409, -155.6989798598866,
    66.80131188771972, -13.28068155288572,
  ];
  const c = [
    -0.007784894002430293, -0.3223964580411365, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    0.007784695709041462, 0.3224671290700398, 2.445134137142996,
    3.754408661907416,
  ];
  const plow = 0.02425;
  const phigh = 1 - plow;
  let q: number;
  let r: number;
  if (u < plow) {
    q = Math.sqrt(-2 * Math.log(u));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (u <= phigh) {
    q = u - 0.5;
    r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
        q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }
  q = Math.sqrt(-2 * Math.log(1 - u));
  return (
    -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  );
}
