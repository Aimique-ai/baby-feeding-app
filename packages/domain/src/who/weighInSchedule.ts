import { addDays, differenceInCalendarDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { dayOfLife, localDateISO } from "../planning/dayBoundary";

// App heuristic, not WHO/NICE; does not color the status.
export const COVERAGE_TOLERANCE_DAYS = 3;

export type WeighInMetric = "early-velocity" | "monthly-velocity";

export type NextWeighIn = {
  dateISO: string;
  ageDays: number;
  metric: WeighInMetric;
};

export type WeighInInput = {
  birthDate: Date;
  tz: string;
  weighingDates: Date[];
  now: Date;
};

const EARLY_BOUNDARY_AGE_DAYS = [14] as const;
const MONTHLY_BOUNDARY_AGE_DAYS = [28, 61, 91, 122, 183] as const;

function isCovered(boundaryLocal: Date, weighingsLocal: Date[]): boolean {
  return weighingsLocal.some(
    (w) =>
      Math.abs(differenceInCalendarDays(w, boundaryLocal)) <=
      COVERAGE_TOLERANCE_DAYS,
  );
}

export function nextTargetWeighIn(input: WeighInInput): NextWeighIn | null {
  const { birthDate, tz, weighingDates, now } = input;
  const birthLocal = toZonedTime(birthDate, tz);
  const nowLocal = toZonedTime(now, tz);
  const ageDaysNow = Math.max(
    0,
    differenceInCalendarDays(nowLocal, birthLocal),
  );

  const weighingsLocal = [
    birthLocal,
    ...weighingDates.map((d) => toZonedTime(d, tz)),
  ];

  const candidates: { ageDays: number; metric: WeighInMetric }[] = [
    ...EARLY_BOUNDARY_AGE_DAYS.map((ageDays) => ({
      ageDays,
      metric: "early-velocity" as const,
    })),
    ...MONTHLY_BOUNDARY_AGE_DAYS.map((ageDays) => ({
      ageDays,
      metric: "monthly-velocity" as const,
    })),
  ].sort((a, b) => a.ageDays - b.ageDays);

  for (const c of candidates) {
    const boundaryLocal = addDays(birthLocal, c.ageDays);
    if (isCovered(boundaryLocal, weighingsLocal)) continue;
    if (ageDaysNow - c.ageDays > COVERAGE_TOLERANCE_DAYS) continue;
    return {
      dateISO: localDateISO(boundaryLocal, tz),
      ageDays: c.ageDays,
      metric: c.metric,
    };
  }

  return null;
}

export type WeeklyWeighIn = { weeks: number };

const DAYS_PER_WEEK = 7;

function isWeeklyBoundary(ageDays: number): boolean {
  return ageDays >= DAYS_PER_WEEK && ageDays % DAYS_PER_WEEK === 0;
}

export type WeeklyWeighInStatus =
  // Today is an exact weekly birthday (day-of-life 7, 14, 21…).
  | { kind: "primary"; weeks: number }
  // Yesterday was the weekly birthday and it's still due (catch-up window).
  | { kind: "catch-up"; weeks: number }
  | null;

/**
 * Weekly weigh-in status on the fixed birthday grid, for a given local "now".
 * "primary" on the exact weekly birthday; "catch-up" the day after one (so a
 * missed boundary can be nudged once on +1). Whether the catch-up should
 * actually fire (i.e. nobody weighed on the boundary day) is the caller's call.
 */
export function weeklyWeighInStatus(
  birthDate: Date,
  now: Date,
  tz: string,
): WeeklyWeighInStatus {
  const ageDays = dayOfLife(birthDate, now, tz);
  if (isWeeklyBoundary(ageDays)) {
    return { kind: "primary", weeks: ageDays / DAYS_PER_WEEK };
  }
  if (isWeeklyBoundary(ageDays - 1)) {
    return { kind: "catch-up", weeks: (ageDays - 1) / DAYS_PER_WEEK };
  }
  return null;
}

/**
 * Soft weekly cadence on a fixed grid anchored to the birth date: due only on
 * exact weekly birthdays (day-of-life 7, 14, 21…), independent of when the last
 * weighing happened. Returns the completed week count, or null on off-grid days.
 */
export function weeklyWeighInDue(
  birthDate: Date,
  now: Date,
  tz: string,
): WeeklyWeighIn | null {
  const status = weeklyWeighInStatus(birthDate, now, tz);
  return status?.kind === "primary" ? { weeks: status.weeks } : null;
}

/** Russian plural for "N недель/недели/неделя". */
export function weeksLabelRu(weeks: number): string {
  const mod100 = weeks % 100;
  const mod10 = weeks % 10;
  if (mod100 >= 11 && mod100 <= 14) return `${weeks} недель`;
  if (mod10 === 1) return `${weeks} неделя`;
  if (mod10 >= 2 && mod10 <= 4) return `${weeks} недели`;
  return `${weeks} недель`;
}
