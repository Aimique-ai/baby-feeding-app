import { addDays, differenceInCalendarDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import type { Baby } from "@leon/schemas/baby";
import type { Weight } from "@leon/schemas/weight";
import {
  lookupCompletedEarlyVelocity,
  lookupCompletedMonthlyVelocityLMS,
  lookupWfaLMS,
  type EarlyVelocityHit,
} from "./lookup";
import { percentileFromZ, zFromMeasurement } from "./zscore";
import type {
  AnalyticsPoint,
  AnalyticsVelocity,
  MonthlyVelocity,
  PercentileTrend,
  WeightsAnalytics,
} from "./analyticsTypes";

export type {
  AnalyticsPoint,
  AnalyticsVelocity,
  WeightsAnalytics,
} from "./analyticsTypes";

const EARLY_MAX_AGE_DAYS = 60;

type Sample = { t: number; w: number };

function interpolate(samples: Sample[], targetT: number): number | null {
  if (samples.length === 0) return null;
  if (targetT < samples[0].t) return null;
  if (targetT >= samples[samples.length - 1].t)
    return samples[samples.length - 1].w;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    if (targetT >= a.t && targetT <= b.t) {
      const span = b.t - a.t;
      if (span === 0) return b.w;
      return a.w + ((b.w - a.w) * (targetT - a.t)) / span;
    }
  }
  return samples[samples.length - 1].w;
}

function classifyEarly(
  delta: number,
  ref: EarlyVelocityHit,
): NonNullable<AnalyticsVelocity["earlyClass"]> {
  if (delta >= ref.p50) return "p50+";
  if (delta >= ref.p25) return "p25-50";
  if (delta >= ref.p10) return "p10-25";
  if (delta >= ref.p5) return "p5-10";
  return "below-p5";
}

export function buildAnalytics(
  baby: Baby,
  weights: Weight[],
  tz: string,
): WeightsAnalytics {
  const ascending = [...weights].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const birthLocal = toZonedTime(new Date(baby.birthDate), tz);
  const nowLocal = toZonedTime(new Date(), tz);
  const ageDaysNow = Math.max(
    0,
    differenceInCalendarDays(nowLocal, birthLocal),
  );

  const samples: Sample[] = [
    { t: birthLocal.getTime(), w: baby.birthWeightGrams },
    ...ascending.map((w) => ({
      t: toZonedTime(new Date(w.date), tz).getTime(),
      w: w.weightGrams,
    })),
  ];

  let prev: { date: Date; weightGrams: number } | null = null;
  const points: AnalyticsPoint[] = ascending.map((w) => {
    const local = toZonedTime(new Date(w.date), tz);
    const ageDays = Math.max(0, differenceInCalendarDays(local, birthLocal));

    const wfaLMS = lookupWfaLMS(baby.sex, ageDays);
    const weightKg = w.weightGrams / 1000;
    const zWfa = zFromMeasurement(weightKg, wfaLMS);
    const pctile = percentileFromZ(zWfa);

    let daysSincePrev: number | null = null;
    let deltaSincePrev: number | null = null;
    let gramsPerDay: number | null = null;
    if (prev) {
      const days = Math.max(1, differenceInCalendarDays(local, prev.date));
      const delta = w.weightGrams - prev.weightGrams;
      daysSincePrev = days;
      deltaSincePrev = delta;
      gramsPerDay = delta / days;
    }

    prev = { date: local, weightGrams: w.weightGrams };

    return {
      _id: w._id,
      date: w.date,
      weightGrams: w.weightGrams,
      ageDays,
      zWeightForAge: zWfa,
      percentile: pctile,
      daysSincePrev,
      deltaSincePrev,
      gramsPerDay,
    };
  });

  const latest = points[points.length - 1] ?? null;
  const dateAtAgeDay = (ageDays: number) => addDays(birthLocal, ageDays);
  const isoAtAgeDay = (ageDays: number) => dateAtAgeDay(ageDays).toISOString();

  let earlyVelocity: AnalyticsVelocity | null = null;
  if (latest && latest.ageDays <= EARLY_MAX_AGE_DAYS) {
    const early = lookupCompletedEarlyVelocity(
      baby.sex,
      baby.birthWeightGrams,
      latest.ageDays,
    );
    if (early) {
      const startT = dateAtAgeDay(early.startDays).getTime();
      const endT = dateAtAgeDay(early.endDays).getTime();
      const startW = interpolate(samples, startT);
      const endW = interpolate(samples, endT);
      if (startW !== null && endW !== null) {
        const delta = endW - startW;
        earlyVelocity = {
          source: "who-early",
          intervalLabel: early.intervalLabel,
          intervalDays: early.endDays - early.startDays,
          fromDate: isoAtAgeDay(early.startDays),
          toDate: isoAtAgeDay(early.endDays),
          fromWeightGrams: Math.round(startW),
          toWeightGrams: Math.round(endW),
          deltaGrams: Math.round(delta),
          z: null,
          percentile: null,
          earlyClass: classifyEarly(delta, early),
          earlyRef: early,
        };
      }
    }
  }

  let monthlyVelocity: MonthlyVelocity | null = null;
  let percentileTrend: PercentileTrend | null = null;

  if (latest) {
    const wv = lookupCompletedMonthlyVelocityLMS(baby.sex, latest.ageDays);
    if (wv) {
      const startT = dateAtAgeDay(wv.startDays).getTime();
      const endT = dateAtAgeDay(wv.endDays).getTime();
      const startW = interpolate(samples, startT);
      const endW = interpolate(samples, endT);
      if (startW !== null && endW !== null) {
        const delta = endW - startW;
        const zV = zFromMeasurement(delta, wv.lms);
        const pV = percentileFromZ(zV);
        monthlyVelocity = {
          fromDate: isoAtAgeDay(wv.startDays),
          toDate: isoAtAgeDay(wv.endDays),
          fromWeightGrams: Math.round(startW),
          toWeightGrams: Math.round(endW),
          deltaGrams: Math.round(delta),
          intervalLabel: wv.intervalLabel,
          intervalDays: wv.intervalDays,
          z: zV,
          percentile: pV,
        };

        const oldLMS = lookupWfaLMS(baby.sex, wv.startDays);
        const newLMS = lookupWfaLMS(baby.sex, wv.endDays);
        const oldZ = zFromMeasurement(startW / 1000, oldLMS);
        const newZ = zFromMeasurement(endW / 1000, newLMS);
        percentileTrend = {
          fromPercentile: percentileFromZ(oldZ),
          toPercentile: percentileFromZ(newZ),
          fromDate: isoAtAgeDay(wv.startDays),
          toDate: isoAtAgeDay(wv.endDays),
        };
      }
    }
  }

  return {
    birthDate: baby.birthDate,
    birthWeightGrams: baby.birthWeightGrams,
    sex: baby.sex,
    ageDaysNow,
    points,
    earlyVelocity,
    monthlyVelocity,
    percentileTrend,
  };
}
