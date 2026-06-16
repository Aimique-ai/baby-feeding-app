import type { FeedingWindow } from "./types";

const MS_PER_HOUR = 3600000;
const MS_PER_MIN = 60_000;

export const STALE_ANCHOR_GRACE_HOURS = 3; // wall-clock; INV-1
export const WINDOW_MIN_HALF_MIN = 30; // minimum half-width around center; INV-3

// A feeding moves the window anchor only if its volume reaches this fraction of
// the minimum portion. Below it the feeding is too small to reset the rhythm; a
// feeding with no recorded volume is never gated by it (treated as a full feed).
export const ANCHOR_MIN_FRACTION = 0.5;

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

// The minimum volume a feeding must reach to move the window anchor. energy:
// minPortion = target/maxC; neonatal: minPortion = perFeedRange[0] (30). The
// same value gates the prev-day anchor query in buildFeedingPlan, so the DB and
// the planner agree on what counts as an anchor.
export function anchorMinMl(
  args: { range: [number, number]; target: number } | { perFeedMl: number },
): number {
  const minPortion =
    "perFeedMl" in args ? args.perFeedMl : args.target / args.range[1];
  return minPortion * ANCHOR_MIN_FRACTION;
}

type WindowPortion =
  | { kind: "energy"; perFeedMl: number }
  | { kind: "neonatal" };

// The window is built from absolute instants only — never reads `now`. The
// staleness guard (which can null the anchor) lives in runPipeline; a returned
// window may be entirely in the past, which is a consumer concern.
export function nextFeedingWindow(args: {
  lastFullFeedingAt: Date | null;
  range: [number, number];
  portion: WindowPortion;
}): FeedingWindow | null {
  const { lastFullFeedingAt, range, portion } = args;
  if (lastFullFeedingAt == null) return null;

  const { intervalMin, intervalMax, intervalTarget } = intervalCorridors(range);
  const base = lastFullFeedingAt.getTime();
  const volumeMl = portion.kind === "energy" ? portion.perFeedMl : 0;

  const centerMs = base + intervalTarget * MS_PER_HOUR;
  const halfMs = WINDOW_MIN_HALF_MIN * MS_PER_MIN;

  // Always widen to at least center ± WINDOW_MIN_HALF_MIN; never narrow a wider
  // corridor. The degenerate [5,5] band would otherwise be zero-width.
  const windowStartMs = Math.min(base + intervalMin * MS_PER_HOUR, centerMs - halfMs);
  const windowEndMs = Math.max(base + intervalMax * MS_PER_HOUR, centerMs + halfMs);

  return {
    windowStart: new Date(windowStartMs),
    windowEnd: new Date(windowEndMs),
    time: new Date(centerMs),
    volumeMl,
  };
}
