import type {
  FeedingHypothesis,
  FeedingLink,
  FreshDeficitWindow,
} from "./analyticsTypes";

// App heuristics, not WHO/NICE thresholds; these never color the status.
export const FRESH_WINDOW_DAYS = 7;
export const FRESH_MIN_COUNTED_DAYS = 3;
export const FRESH_DEFICIT_YELLOW_FRACTION = 0.17;

export type FreshDay = {
  dateISO: string;
  target: number | null;
  factOfDay: number;
};

export type FeedingLinkInput = {
  // Fresh-window days, ascending. Today is already excluded by the caller.
  days: FreshDay[];
  // Completed-interval velocity z (for hypotheses); null when unavailable.
  velocityZ: number | null;
};

export function computeFeedingLink(input: FeedingLinkInput): FeedingLink {
  const { days, velocityZ } = input;
  const daysInWindow = days.length;
  const counted = days.filter((d) => d.target !== null);
  const daysCounted = counted.length;

  const fromDate = days[0]?.dateISO ?? "";
  const toDate = days[days.length - 1]?.dateISO ?? "";

  if (daysCounted < FRESH_MIN_COUNTED_DAYS) {
    const fresh: FreshDeficitWindow = {
      windowKind: "fresh-recent",
      fromDate,
      toDate,
      daysCounted,
      daysInWindow,
      avgDeficitMl: null,
      avgTargetMl: null,
      exceedsYellowThreshold: false,
    };
    return { fresh, hypothesis: "no-axis" };
  }

  const avgTargetMl =
    counted.reduce((s, d) => s + (d.target as number), 0) / daysCounted;
  const avgDeficitMl =
    counted.reduce((s, d) => s + ((d.target as number) - d.factOfDay), 0) /
    daysCounted;

  const exceedsYellowThreshold =
    avgTargetMl > 0 && avgDeficitMl / avgTargetMl > FRESH_DEFICIT_YELLOW_FRACTION;

  const fresh: FreshDeficitWindow = {
    windowKind: "fresh-recent",
    fromDate,
    toDate,
    daysCounted,
    daysInWindow,
    avgDeficitMl,
    avgTargetMl,
    exceedsYellowThreshold,
  };

  return { fresh, hypothesis: hypothesisFor(exceedsYellowThreshold, velocityZ) };
}

function hypothesisFor(
  exceedsYellowThreshold: boolean,
  velocityZ: number | null,
): FeedingHypothesis {
  const lowGrowth = velocityZ !== null && velocityZ < -1;
  if (lowGrowth && exceedsYellowThreshold) return "intake-likely-low";
  if (lowGrowth && !exceedsYellowThreshold) return "plan-held-no-growth";
  if (exceedsYellowThreshold) return "fresh-slip-not-yet-reflected";
  return "no-axis";
}
