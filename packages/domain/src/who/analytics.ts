import { addDays, differenceInCalendarDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import type { Baby } from "@leon/schemas/baby";
import type { Weight } from "@leon/schemas/weight";
import { localDateISO } from "../planning/dayBoundary";
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
  WeeklyGainRow,
  WeightsAnalytics,
} from "./analyticsTypes";

export type {
  AnalyticsPoint,
  AnalyticsVelocity,
  WeightsAnalytics,
} from "./analyticsTypes";

const EARLY_MAX_AGE_DAYS = 60;

// Velocity is computed from real weigh-ins only — a WHO interval boundary counts
// as "covered" when a real weigh-in exists within ±3 days. No interpolation is
// allowed into the verdict; this tolerance is an app heuristic.
const COVERAGE_TOLERANCE_DAYS = 3;

// Gain summary: adaptation (days 0–14) as its own row; the gain phase is a greedy
// chain of ≥7-day segments (g/day over shorter spans is just scale noise).
const ADAPTATION_END_DAY = 14;
const MIN_GAIN_GAP_DAYS = 7;

type Sample = { t: number; w: number };

function coveredWeightAt(samples: Sample[], boundaryDate: Date): number | null {
  let best: { absDays: number; w: number } | null = null;
  for (const s of samples) {
    const days = Math.abs(
      differenceInCalendarDays(new Date(s.t), boundaryDate),
    );
    if (days <= COVERAGE_TOLERANCE_DAYS) {
      if (!best || days < best.absDays) best = { absDays: days, w: s.w };
    }
  }
  return best ? best.w : null;
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

// Per-segment gain summary. Adaptation (0–14) is one row of loss/recovery; the
// gain phase is a greedy chain of ≥7-day segments with g/day over the actual
// days between real weigh-ins. An incomplete tail (<7d) is not emitted.
function buildWeeklyGain(
  points: AnalyticsPoint[],
  birthWeightGrams: number,
): WeeklyGainRow[] {
  if (points.length < 2) return [];
  const rows: WeeklyGainRow[] = [];

  // End of adaptation = first real weigh-in at day ≥14.
  const adaptEnd = points.find((p) => p.ageDays >= ADAPTATION_END_DAY) ?? null;

  if (adaptEnd) {
    const scope = points.filter((p) => p.ageDays <= adaptEnd.ageDays);
    const nadir = scope.reduce((m, p) => (p.weightGrams < m.weightGrams ? p : m), scope[0]);
    const lossPct =
      birthWeightGrams > 0
        ? ((birthWeightGrams - nadir.weightGrams) / birthWeightGrams) * 100
        : 0;
    rows.push({
      kind: "adaptation",
      fromDay: 0,
      toDay: adaptEnd.ageDays,
      fromGrams: birthWeightGrams,
      toGrams: adaptEnd.weightGrams,
      deltaGrams: adaptEnd.weightGrams - birthWeightGrams,
      days: adaptEnd.ageDays,
      gramsPerDay: null,
      percentile: adaptEnd.percentile,
      nadirGrams: nadir.weightGrams,
      nadirDay: nadir.ageDays,
      lossPct,
      recovered: adaptEnd.weightGrams >= birthWeightGrams,
    });
  }

  // Gain phase anchored at the end of adaptation (no adaptEnd → no gain chain).
  if (adaptEnd) {
    let from = adaptEnd;
    for (;;) {
      const next = points.find((p) => p.ageDays >= from.ageDays + MIN_GAIN_GAP_DAYS);
      if (!next) break; // skip the incomplete (<7d) tail
      const days = next.ageDays - from.ageDays;
      rows.push({
        kind: "gain",
        fromDay: from.ageDays,
        toDay: next.ageDays,
        fromGrams: from.weightGrams,
        toGrams: next.weightGrams,
        deltaGrams: next.weightGrams - from.weightGrams,
        days,
        gramsPerDay: Math.round((next.weightGrams - from.weightGrams) / days),
        percentile: next.percentile,
      });
      from = next;
    }
  }

  return rows;
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

  // The birth point counts as a real weigh-in only for the left boundary of the
  // first interval, so keep it separate from realSamples.
  const birthSample: Sample = {
    t: birthLocal.getTime(),
    w: baby.birthWeightGrams,
  };
  const realSamples: Sample[] = ascending.map((w) => ({
    t: toZonedTime(new Date(w.date), tz).getTime(),
    w: w.weightGrams,
  }));

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
      // g/day only over intervals ≥7 days; the UI renders "—" otherwise.
      gramsPerDay = days < 7 ? null : delta / days;
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
    // Known limitation: the 2000–2500g birth-weight group is not vendored in
    // velocity-early.json, so lookupCompletedEarlyVelocity is null across 0–60d
    // for it and the verdict falls back to adaptation-loss-only.
    const early = lookupCompletedEarlyVelocity(
      baby.sex,
      baby.birthWeightGrams,
      latest.ageDays,
    );
    if (early) {
      const startDate = dateAtAgeDay(early.startDays);
      const endDate = dateAtAgeDay(early.endDays);
      const startW =
        early.startDays === 0
          ? birthSample.w
          : coveredWeightAt(realSamples, startDate);
      const endW = coveredWeightAt(realSamples, endDate);
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
          toDateISO: localDateISO(endDate, tz),
          nextWeighInDateISO: null,
        };
      }
    }
  }

  let monthlyVelocity: MonthlyVelocity | null = null;
  let percentileTrend: PercentileTrend | null = null;
  let monthlyNextWeighInDateISO: string | null = null;

  if (latest) {
    const wv = lookupCompletedMonthlyVelocityLMS(baby.sex, latest.ageDays);
    if (wv) {
      const startDate = dateAtAgeDay(wv.startDays);
      const endDate = dateAtAgeDay(wv.endDays);
      const startW =
        wv.startDays === 0
          ? birthSample.w
          : coveredWeightAt(realSamples, startDate);
      const endW = coveredWeightAt(realSamples, endDate);
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
          toDateISO: localDateISO(endDate, tz),
          nextWeighInDateISO: null,
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
      } else {
        monthlyNextWeighInDateISO =
          endW === null
            ? localDateISO(endDate, tz)
            : localDateISO(startDate, tz);
      }
    }
  }

  if (monthlyVelocity === null && earlyVelocity) {
    earlyVelocity = {
      ...earlyVelocity,
      nextWeighInDateISO: monthlyNextWeighInDateISO,
    };
  }

  return {
    birthDate: baby.birthDate,
    birthWeightGrams: baby.birthWeightGrams,
    sex: baby.sex,
    ageDaysNow,
    points,
    weeklyGain: buildWeeklyGain(points, baby.birthWeightGrams),
    earlyVelocity,
    monthlyVelocity,
    percentileTrend,
    verdict: null,
    feedingLink: null,
  };
}
