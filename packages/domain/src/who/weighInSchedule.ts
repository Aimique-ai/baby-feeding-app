import { addDays, differenceInCalendarDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { localDateISO } from "../planning/dayBoundary";

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
