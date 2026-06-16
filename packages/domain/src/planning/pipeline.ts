import { round5 } from "../math/round";
import {
  anchorMinMl,
  intervalCorridors,
  nextFeedingWindow,
  STALE_ANCHOR_GRACE_HOURS,
} from "./remainderPlan";
import type { Feeding, FeedingWindow } from "./types";

const MS_PER_HOUR = 3600000;

export type PipelineResult = {
  consumed: number;
  nextWindow: FeedingWindow | null;
};

type RunPipelineArgs =
  | {
      mode: "energy";
      facts: Feeding[];
      target: number;
      dateISO: string;
      tz: string;
      range: [number, number];
      prevAnchor: Feeding | null;
    }
  | {
      mode: "neonatal";
      facts: Feeding[];
      perFeedRange: [number, number];
      dateISO: string;
      tz: string;
      range: [number, number];
      prevAnchor: Feeding | null;
    };

type WindowPortion =
  | { kind: "energy"; perFeedMl: number }
  | { kind: "neonatal" };

export function runPipeline(args: RunPipelineArgs, now: Date): PipelineResult {
  const { facts, range, prevAnchor } = args;

  // Anchor threshold — a feeding only moves the window if it is at least a
  // fraction of the minimum portion. A feeding with no recorded volume (breast,
  // "по режиму") counts as a full feeding. minPortion = target/maxC (energy) /
  // perFeedRange[0] (neonatal); see anchorMinMl.
  const minMl =
    args.mode === "energy"
      ? anchorMinMl({ range, target: args.target })
      : anchorMinMl({ perFeedMl: args.perFeedRange[0] });

  const movesAnchor = (f: Feeding): boolean =>
    f.volumeMl == null || f.volumeMl >= minMl;

  // consumed — flat sum of ALL today facts. The anchor threshold never affects
  // this sum.
  let consumed = 0;
  for (const f of facts) consumed += f.volumeMl ?? 0;

  // Last anchor-worthy feeding ACROSS the day boundary. prevAnchor is the
  // DB-resolved most-recent qualifying feeding before today (already volume-
  // filtered); today's facts are filtered here. Pick the MAX timestamp.
  let lastFullFeedingAt: Date | null = prevAnchor ? prevAnchor.startAt : null;
  for (const f of facts) {
    if (!movesAnchor(f)) continue;
    if (
      lastFullFeedingAt == null ||
      f.startAt.getTime() > lastFullFeedingAt.getTime()
    ) {
      lastFullFeedingAt = f.startAt;
    }
  }

  // Staleness guard (INSTANT arithmetic). If the anchor is older than the full
  // interval PLUS the wall-clock grace, there is no live rhythm to predict from:
  // treat as no anchor. GRACE (3h) >> the worker's TOLERANCE_MIN guarantees the
  // window stays non-null while the "end" reminder can still fire (INV-1).
  if (lastFullFeedingAt != null) {
    const { intervalMax } = intervalCorridors(range);
    const thresholdMs = (intervalMax + STALE_ANCHOR_GRACE_HOURS) * MS_PER_HOUR;
    if (now.getTime() - lastFullFeedingAt.getTime() > thresholdMs) {
      lastFullFeedingAt = null;
    }
  }

  // Per-feed number for the window (energy, display-only — volume never affects
  // timing). round5(dailyMl/maxC) is deliberately = guidance.mlPerFeedRange[0]
  // so the on-screen number agrees with the "Сколько давать" card's lower bound.
  const portion: WindowPortion =
    args.mode === "energy"
      ? { kind: "energy", perFeedMl: round5(args.target / range[1]) }
      : { kind: "neonatal" };

  const nextWindow = nextFeedingWindow({ lastFullFeedingAt, range, portion });
  return { consumed, nextWindow };
}
