/**
 * PRD §4.3 (locked) — single next-slot shift.
 *
 * Computes a signed minute offset to add to (factStartAt + 3h) when placing
 * the next planned slot. Two axes, mutually exclusive (one is always 0):
 *
 *   v_shift (volume deviation):
 *     dev = (factVolumeMl − ideal) / ideal
 *     |dev| ≤ 0.2          → 0          (INCLUSIVE on 0.2)
 *     0.2 < |dev| < 0.6    → round(30 · (|dev| − 0.2) / 0.4) · sign(dev)
 *     |dev| ≥ 0.6          → 30 · sign(dev)
 *
 *   t_shift (early-arrival deviation, only when v_shift == 0):
 *     earlyMin = ((prev.startAt + 3h) − factStartAt) in minutes
 *     earlyMin ≤ 30        → 0
 *     30 < earlyMin < 60   → round(30 · (earlyMin − 30) / 30)
 *     earlyMin ≥ 60        → 30
 *     earlyMin < 0  (late) → 0
 *
 * Returns v_shift + t_shift, in [-30, +30].
 */
export function computeShiftMinutes(args: {
  factVolumeMl: number;
  idealPortion: number;
  factStartAt: Date;
  prevStartAt: Date;
}): number {
  const { factVolumeMl, idealPortion, factStartAt, prevStartAt } = args;

  const dev = (factVolumeMl - idealPortion) / idealPortion;
  const absDev = Math.abs(dev);

  let vShift = 0;
  if (absDev <= 0.2) {
    vShift = 0;
  } else if (absDev < 0.6) {
    vShift = Math.round(30 * ((absDev - 0.2) / 0.4)) * Math.sign(dev);
  } else {
    vShift = 30 * Math.sign(dev);
  }

  let tShift = 0;
  if (vShift === 0) {
    const idealNextMs = prevStartAt.getTime() + 3 * 60 * 60 * 1000;
    const earlyMin = (idealNextMs - factStartAt.getTime()) / 60000;
    if (earlyMin < 0 || earlyMin <= 30) {
      tShift = 0;
    } else if (earlyMin < 60) {
      tShift = Math.round(30 * ((earlyMin - 30) / 30));
    } else {
      tShift = 30;
    }
  }

  return vShift + tShift;
}
