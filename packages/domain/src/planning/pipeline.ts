import { startOfLocalDay, isBirthday } from "./dayBoundary";
import {
  ageCorridors,
  intervalCorridors,
  planRemainder,
  snackStretch,
} from "./remainderPlan";
import type { Feeding, RemainderPlan } from "./types";

const MS_PER_HOUR = 3600000;

export type PipelineResult = {
  consumed: number;
  mainsToday: number;
  dayAnchor: Date;
  tailAnchor: Date;
  snackStretchHours: number;
  lastFactAt: Date | null;
  plan: RemainderPlan;
};

type RunPipelineArgs =
  | {
      mode: "energy";
      facts: Feeding[];
      target: number;
      dateISO: string;
      tz: string;
      range: [number, number];
      birthDate: Date;
      prevMainCandidates: Feeding[];
    }
  | {
      mode: "neonatal";
      facts: Feeding[];
      perFeedRange: [number, number];
      dateISO: string;
      tz: string;
      range: [number, number];
      birthDate: Date;
      prevMainCandidates: Feeding[];
    };

export function runPipeline(args: RunPipelineArgs): PipelineResult {
  const { facts, dateISO, tz, range, birthDate, prevMainCandidates } = args;

  const dayStart = startOfLocalDay(dateISO, tz);

  // portionMin — the "main vs snack" threshold. energy ⇒ target/maxC;
  // neonatal ⇒ lower edge of perFeed (30). Interval corridors are the same
  // for both modes.
  let portionMin: number;
  let intervalMax: number;
  let intervalTarget: number;
  if (args.mode === "energy") {
    const corridors = ageCorridors({ range, target: args.target });
    portionMin = corridors.portionMin;
    intervalMax = corridors.intervalMax;
    intervalTarget = corridors.intervalTarget;
  } else {
    const interval = intervalCorridors(range);
    portionMin = args.perFeedRange[0];
    intervalMax = interval.intervalMax;
    intervalTarget = interval.intervalTarget;
  }

  const isMainLike = (f: Feeding): boolean =>
    !f.isTopUp || (f.volumeMl ?? 0) >= portionMin;

  const prevSorted = [...prevMainCandidates].sort(
    (a, b) => a.startAt.getTime() - b.startAt.getTime(),
  );
  let prevMainRaw: Feeding | null = null;
  for (const f of prevSorted) {
    if (isMainLike(f)) prevMainRaw = f;
  }

  const prevMainAnchorFresh =
    prevMainRaw &&
    dayStart.getTime() - prevMainRaw.startAt.getTime() <=
      intervalMax * MS_PER_HOUR
      ? prevMainRaw.startAt
      : null;

  const sorted = [...facts].sort(
    (a, b) => a.startAt.getTime() - b.startAt.getTime(),
  );

  let consumed = 0;
  let mainsToday = 0;
  let firstMainToday: Date | null = null;
  let lastTailMove: Date | null = null;
  let snackStretchHours = 0;
  let lastFactAt: Date | null = null;

  for (const f of sorted) {
    consumed += f.volumeMl ?? 0;
    lastFactAt = f.startAt;

    if (isMainLike(f)) {
      lastTailMove = f.startAt;
      snackStretchHours = 0;
      if (f.startAt.getTime() >= dayStart.getTime()) {
        mainsToday += 1;
        if (firstMainToday === null) firstMainToday = f.startAt;
      }
    } else {
      snackStretchHours += snackStretch({
        volumeMl: f.volumeMl ?? 0,
        portionMin,
        intervalMax,
        intervalTarget,
      });
    }
  }

  const dayAnchor = isBirthday(birthDate, dateISO, tz)
    ? birthDate
    : (firstMainToday ?? prevMainAnchorFresh ?? dayStart);

  const tailAnchor = lastTailMove ?? prevMainAnchorFresh ?? dayAnchor;

  const plan =
    args.mode === "energy"
      ? planRemainder({
          mode: "energy",
          target: args.target,
          consumed,
          dayAnchor,
          tailAnchor,
          snackStretchHours,
          lastFactAt,
          range,
          dateISO,
          tz,
        })
      : planRemainder({
          mode: "neonatal",
          perFeedRange: args.perFeedRange,
          dayAnchor,
          tailAnchor,
          snackStretchHours,
          lastFactAt,
          range,
          dateISO,
          tz,
        });

  return {
    consumed,
    mainsToday,
    dayAnchor,
    tailAnchor,
    snackStretchHours,
    lastFactAt,
    plan,
  };
}
