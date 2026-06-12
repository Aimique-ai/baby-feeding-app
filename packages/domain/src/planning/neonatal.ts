/**
 * Neonatal regime (days 0–13): flat per-feed volume range.
 *
 * Spec: during the first two weeks we don't set a daily target or deficit —
 * instead a fixed range of 30–60 ml per feed at 8–12 feeds per day. The time
 * schedule is driven by frequency, not by deficit (target − consumed). The baby
 * takes as much as needed.
 */
export function neonatalPerFeedRange(): [number, number] {
  return [30, 60];
}
