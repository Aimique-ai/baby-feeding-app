import "server-only";
import { differenceInCalendarDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import type {
  SerializedBaby,
  SerializedWeight,
} from "@/lib/api/serializedTypes";
import {
  lookupEarlyVelocity,
  lookupVelocityLMS,
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

const DAY_MS = 24 * 60 * 60 * 1000;
const WHO_MONTHLY_WINDOW = 28;
const EARLY_MAX_AGE_DAYS = 60;
const EARLY_MAX_INTERVAL = 21;

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
  baby: SerializedBaby,
  weights: SerializedWeight[],
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

  // Samples с виртуальной точкой рождения для интерполяции:
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
    let earlyVelocity: AnalyticsVelocity | null = null;
    if (prev) {
      const days = Math.max(1, differenceInCalendarDays(local, prev.date));
      const delta = w.weightGrams - prev.weightGrams;
      daysSincePrev = days;
      deltaSincePrev = delta;
      gramsPerDay = delta / days;

      // ВОЗ-оценка по early-таблице — только когда возраст и интервал подходят.
      if (ageDays <= EARLY_MAX_AGE_DAYS && days <= EARLY_MAX_INTERVAL) {
        const early = lookupEarlyVelocity(
          baby.sex,
          baby.birthWeightGrams,
          ageDays,
        );
        if (early) {
          earlyVelocity = {
            source: "who-early",
            intervalLabel: early.intervalLabel,
            intervalDays: days,
            z: null,
            percentile: null,
            earlyClass: classifyEarly(delta, early),
            earlyRef: early,
          };
        }
      }
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
      earlyVelocity,
    };
  });

  // Monthly velocity: только если ageDaysNow ≥ 28 и есть точка хотя бы 28 дн назад.
  let monthlyVelocity: MonthlyVelocity | null = null;
  let percentileTrend: PercentileTrend | null = null;

  if (points.length >= 1 && ageDaysNow >= WHO_MONTHLY_WINDOW) {
    const latest = points[points.length - 1];
    const latestLocal = toZonedTime(new Date(latest.date), tz);
    const targetT = latestLocal.getTime() - WHO_MONTHLY_WINDOW * DAY_MS;

    // Берём только если targetT >= birthT (т.е. 28 дней назад уже после рождения)
    if (targetT >= birthLocal.getTime()) {
      const wAtTarget = interpolate(samples, targetT);
      if (wAtTarget !== null) {
        const delta = latest.weightGrams - wAtTarget;
        // Выбираем ВОЗ-окно ~1мес, по возрасту latest.
        const wv = lookupVelocityLMS(baby.sex, WHO_MONTHLY_WINDOW, latest.ageDays);
        if (wv) {
          const zV = zFromMeasurement(delta, wv.lms);
          const pV = percentileFromZ(zV);
          monthlyVelocity = {
            fromDate: new Date(targetT).toISOString(),
            toDate: latest.date,
            fromWeightGrams: Math.round(wAtTarget),
            toWeightGrams: latest.weightGrams,
            deltaGrams: Math.round(delta),
            intervalLabel: wv.intervalLabel,
            z: zV,
            percentile: pV,
          };
        }
      }

      // Тренд перцентиля: интерполируем вес 28 дн назад → считаем перцентиль на тот возраст.
      const ageAtTarget = latest.ageDays - WHO_MONTHLY_WINDOW;
      if (ageAtTarget >= 0) {
        const wAtTarget = interpolate(samples, targetT);
        if (wAtTarget !== null) {
          const oldLMS = lookupWfaLMS(baby.sex, ageAtTarget);
          const oldZ = zFromMeasurement(wAtTarget / 1000, oldLMS);
          const oldP = percentileFromZ(oldZ);
          percentileTrend = {
            fromPercentile: oldP,
            toPercentile: latest.percentile,
            fromDate: new Date(targetT).toISOString(),
            toDate: latest.date,
          };
        }
      }
    }
  }

  return {
    birthDate: baby.birthDate,
    birthWeightGrams: baby.birthWeightGrams,
    sex: baby.sex,
    ageDaysNow,
    points,
    monthlyVelocity,
    percentileTrend,
  };
}
