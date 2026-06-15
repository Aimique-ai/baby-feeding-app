import { addMilliseconds } from "date-fns";
import { localDateISO } from "./dayBoundary";
import type { RemainderPlan, Slot, SlotCountSolution } from "./types";

const MS_PER_HOUR = 3600000;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Target-free interval corridor — feeding frequency by age range. */
export function intervalCorridors(range: [number, number]): {
  intervalMin: number;
  intervalMax: number;
  intervalTarget: number;
} {
  const [minC, maxC] = range;
  return {
    intervalMin: 24 / maxC,
    intervalMax: 24 / minC,
    intervalTarget: 24 / Math.round((minC + maxC) / 2),
  };
}

export function ageCorridors(args: {
  range: [number, number];
  target: number;
}): {
  intervalMin: number;
  intervalMax: number;
  intervalTarget: number;
  portionMin: number;
  portionMax: number;
} {
  const { range, target } = args;
  const [minC, maxC] = range;

  const interval = intervalCorridors(range);

  const portionMin = target / maxC;
  const portionMax = target / minC;

  return { ...interval, portionMin, portionMax };
}

export function snackStretch(args: {
  volumeMl: number;
  portionMin: number;
  intervalMax: number;
  intervalTarget: number;
}): number {
  const { volumeMl, portionMin, intervalMax, intervalTarget } = args;
  const ratio = clamp(volumeMl / portionMin, 0, 1);
  const maxStretch = Math.max(0, intervalMax - intervalTarget);
  return ratio * maxStretch;
}

export function solveSlotCount(args: {
  horizonHours: number;
  intervalMin: number;
  intervalMax: number;
  intervalTarget: number;
}): SlotCountSolution {
  const { horizonHours, intervalMin, intervalMax, intervalTarget } = args;

  if (horizonHours <= 0) {
    return { n: 0, stepHours: 0, reason: "empty" };
  }

  const nCap = Math.max(1, Math.ceil(horizonHours / intervalMin));

  let bestN = -1;
  let bestDist = Infinity;
  for (let N = 1; N <= nCap + 1; N++) {
    const step = horizonHours / (N + 1);
    if (step < intervalMin - 1e-9 || step > intervalMax + 1e-9) continue;
    const dist = Math.abs(step - intervalTarget);
    if (dist < bestDist - 1e-9) {
      bestN = N;
      bestDist = dist;
    }
  }

  if (bestN > 0) {
    return {
      n: bestN,
      stepHours: horizonHours / (bestN + 1),
      reason: "in-corridor",
    };
  }

  const candidateN = Math.ceil(horizonHours / intervalMax - 1);
  if (candidateN < 1) {
    return { n: 0, stepHours: 0, reason: "empty" };
  }
  return {
    n: candidateN,
    stepHours: horizonHours / (candidateN + 1),
    reason: "squeezed",
  };
}

type PortionArg =
  | {
      kind: "target";
      remainingMl: number;
      portionMin: number;
      portionMax: number;
    }
  | { kind: "flat"; perFeedRange: [number, number] };

export function placeSlots(args: {
  startOfLayout: Date;
  n: number;
  stepHours: number;
  intervalMin: number;
  intervalMax: number;
  portion: PortionArg;
}): { today: Slot[]; horizonNode: Slot | null } {
  const {
    startOfLayout,
    n,
    stepHours,
    intervalMin,
    intervalMax,
    portion: portionArg,
  } = args;

  if (n <= 0) return { today: [], horizonNode: null };

  const portion =
    portionArg.kind === "target"
      ? clamp(
          portionArg.remainingMl / n,
          portionArg.portionMin,
          portionArg.portionMax,
        )
      : // flat: remainingMl is never read; slot volume is the lower edge of the
        // range (conservative floor), the range is surfaced in the UI separately.
        portionArg.perFeedRange[0];

  // The window for slot i is anchored on the previous rhythm node
  // (startOfLayout + (i-1)·step) plus the age interval corridor: windowStart at
  // intervalMin, windowEnd at intervalMax. The center stays at +step.
  const slotAt = (i: number): Slot => {
    const prevNode = addMilliseconds(
      startOfLayout,
      (i - 1) * stepHours * MS_PER_HOUR,
    );
    return {
      time: addMilliseconds(prevNode, stepHours * MS_PER_HOUR),
      volumeMl: portion,
      windowStart: addMilliseconds(prevNode, intervalMin * MS_PER_HOUR),
      windowEnd: addMilliseconds(prevNode, intervalMax * MS_PER_HOUR),
    };
  };

  const today: Slot[] = [];
  for (let i = 1; i <= n; i++) {
    today.push(slotAt(i));
  }
  const horizonNode = slotAt(n + 1);

  return { today, horizonNode };
}

type PlanRemainderArgs =
  | {
      mode: "energy";
      target: number;
      consumed: number;
      dayAnchor: Date;
      tailAnchor: Date;
      snackStretchHours: number;
      lastFactAt: Date | null;
      range: [number, number];
      dateISO: string;
      tz: string;
    }
  | {
      mode: "neonatal";
      perFeedRange: [number, number];
      dayAnchor: Date;
      tailAnchor: Date;
      snackStretchHours: number;
      lastFactAt: Date | null;
      range: [number, number];
      dateISO: string;
      tz: string;
    };

export function planRemainder(args: PlanRemainderArgs): RemainderPlan {
  const {
    dayAnchor,
    tailAnchor,
    snackStretchHours,
    lastFactAt,
    range,
    dateISO,
    tz,
  } = args;

  const horizonEnd = addMilliseconds(dayAnchor, 24 * MS_PER_HOUR);
  const stretchedTail = addMilliseconds(
    tailAnchor,
    snackStretchHours * MS_PER_HOUR,
  );

  const lowerByFact = lastFactAt ?? stretchedTail;
  const startMs = Math.max(
    stretchedTail.getTime(),
    lowerByFact.getTime(),
    dayAnchor.getTime(),
  );
  const startOfLayout = new Date(startMs);

  const horizonHours = Math.max(
    0,
    (horizonEnd.getTime() - startOfLayout.getTime()) / MS_PER_HOUR,
  );

  const interval = intervalCorridors(range);

  // tomorrowSlot volume: energy ⇒ portionMin; neonatal ⇒ lower edge of perFeed (30).
  const tomorrowVolumeMl =
    args.mode === "energy" ? args.target / range[1] : args.perFeedRange[0];

  // tomorrowSlot window is anchored on tailAnchor + the interval corridor, same
  // rule as placeSlots (prevNode = tailAnchor): center at intervalTarget,
  // windowEnd at intervalMax — the upper bound the reminder fires on.
  const projectedTomorrow = addMilliseconds(
    tailAnchor,
    interval.intervalTarget * MS_PER_HOUR,
  );
  const tomorrowSlot: Slot | null =
    localDateISO(projectedTomorrow, tz) !== dateISO
      ? {
          time: projectedTomorrow,
          volumeMl: tomorrowVolumeMl,
          windowStart: addMilliseconds(
            tailAnchor,
            interval.intervalMin * MS_PER_HOUR,
          ),
          windowEnd: addMilliseconds(
            tailAnchor,
            interval.intervalMax * MS_PER_HOUR,
          ),
        }
      : null;

  if (horizonHours <= 0) {
    return {
      n: 0,
      reason: "empty",
      stepHours: 0,
      horizonHours,
      slotVolumeMl: 0,
      slots: [],
      tomorrowSlot,
    };
  }

  const { n, stepHours, reason } = solveSlotCount({
    horizonHours,
    intervalMin: interval.intervalMin,
    intervalMax: interval.intervalMax,
    intervalTarget: interval.intervalTarget,
  });

  const portion: PortionArg =
    args.mode === "energy"
      ? {
          kind: "target",
          remainingMl: Math.max(0, args.target - args.consumed),
          portionMin: args.target / range[1],
          portionMax: args.target / range[0],
        }
      : { kind: "flat", perFeedRange: args.perFeedRange };

  const { today } = placeSlots({
    startOfLayout,
    n,
    stepHours,
    intervalMin: interval.intervalMin,
    intervalMax: interval.intervalMax,
    portion,
  });

  return {
    n,
    reason,
    stepHours,
    horizonHours,
    slotVolumeMl: today.length > 0 ? today[0].volumeMl : 0,
    slots: today,
    tomorrowSlot,
  };
}
