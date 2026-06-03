/**
 * Manual run of the growth verdict over various inputs.
 * Run from packages/domain:  pnpm dlx tsx scripts/check-verdict.ts
 * (tsx loads the @leon/domain TS sources directly; no build step needed.)
 *
 * Not a unit test (the repo has none) — a self-checking PASS/FAIL script.
 */
import { buildAnalytics } from "../src/who/analytics";
import { computeGrowthVerdict } from "../src/who/verdict";
import { computeFeedingLink, type FreshDay } from "../src/who/feedingLink";
import { nextTargetWeighIn } from "../src/who/weighInSchedule";
import { lookupWfaLMS } from "../src/who/lookup";
import { measurementFromZ, zFromPercentile } from "../src/who/zscore";
import type {
  FeedingLink,
  GrowthVerdict,
  VerdictBoundaryState,
  VerdictSignalKey,
  VerdictStatus,
} from "../src/who/analyticsTypes";

const TZ = "Europe/Bucharest";
const BIRTH = "2025-12-01T06:00:00.000Z";

type Sex = "male" | "female";
function baby(over: { birthWeightGrams?: number; sex?: Sex; birthDate?: string } = {}) {
  return {
    _id: "baby",
    birthDate: over.birthDate ?? BIRTH,
    birthWeightGrams: over.birthWeightGrams ?? 3500,
    sex: over.sex ?? ("male" as Sex),
  };
}
function w(dateISO: string, grams: number) {
  return { _id: dateISO, date: `${dateISO}T08:00:00.000Z`, weightGrams: grams };
}

function verdictOf(
  weights: ReturnType<typeof w>[],
  feedingLink: FeedingLink | null = null,
  b = baby(),
): GrowthVerdict | null {
  const a = buildAnalytics(b as never, weights as never, TZ);
  return computeGrowthVerdict(a, feedingLink);
}

// Fresh deficit window: n full days with the same target/fact.
function freshDays(target: number | null, fact: number, n = 7): FreshDay[] {
  return Array.from({ length: n }, (_, i) => ({
    dateISO: `2026-01-${String(10 + i).padStart(2, "0")}`,
    target,
    factOfDay: fact,
  }));
}

// ---- mini harness ----
let passed = 0;
let failed = 0;
const failures: string[] = [];

function expect(name: string, cond: boolean, detail = "") {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function check(
  name: string,
  v: GrowthVerdict | null,
  exp: {
    isNull?: boolean;
    status?: VerdictStatus;
    boundaryState?: VerdictBoundaryState;
    has?: VerdictSignalKey[];
    lacks?: VerdictSignalKey[];
    noClinical?: boolean;
    notRed?: boolean;
  },
) {
  if (exp.isNull) {
    expect(name, v === null, `got ${v ? v.status : "null"}`);
    return;
  }
  if (v === null) {
    expect(name, false, "verdict is null, expected an object");
    return;
  }
  const sig = v.signals;
  if (exp.status) expect(`${name} · status=${exp.status}`, v.status === exp.status, `got ${v.status}`);
  if (exp.boundaryState)
    expect(
      `${name} · boundary=${exp.boundaryState}`,
      v.boundaryState === exp.boundaryState,
      `got ${v.boundaryState}`,
    );
  for (const s of exp.has ?? [])
    expect(`${name} · has ${s}`, sig.includes(s), `signals=${JSON.stringify(sig)}`);
  for (const s of exp.lacks ?? [])
    expect(`${name} · lacks ${s}`, !sig.includes(s), `signals=${JSON.stringify(sig)}`);
  if (exp.notRed)
    expect(`${name} · not RED`, v.status !== "clinical-attention", `status=${v.status}`);
  if (exp.noClinical)
    expect(
      `${name} · no clinical reason`,
      v.reasons.every((r) => !r.isClinical),
      `reasons=${JSON.stringify(v.reasons.map((r) => r.code))}`,
    );
}

console.log("\n=== Boundary gates ===");
// <2 real weigh-ins → null
check("one weigh-in", verdictOf([w("2026-01-05", 4900)]), { isNull: true });
check("zero weigh-ins", verdictOf([]), { isNull: true });
// Garbage birth data
check(
  "broken birthWeight",
  verdictOf([w("2025-12-06", 3400), w("2025-12-29", 4600)], null, baby({ birthWeightGrams: 0 })),
  { isNull: true },
);
// Adaptation (days 0–13): 2 real points
check("adaptation 0-13d", verdictOf([w("2025-12-02", 3450), w("2025-12-06", 3350)]), {
  boundaryState: "adaptation-loss-only",
  notRed: true,
});
// velocity-unavailable: uncovered right boundary
check(
  "velocity-unavailable (uncovered boundary)",
  verdictOf([w("2025-12-06", 3600), w("2026-01-10", 5100)]),
  { boundaryState: "velocity-unavailable", lacks: ["velocity-low-strong", "velocity-low-mild"] },
);

console.log("\n=== Clinical (🔴) ===");
check("below-p2", verdictOf([w("2025-12-06", 2200), w("2025-12-29", 2500)], null, baby({ birthWeightGrams: 2400 })), {
  status: "clinical-attention",
  has: ["below-p2"],
});
check(
  "early-loss >10% in adaptation",
  verdictOf([w("2025-12-02", 3500), w("2025-12-06", 3100)]),
  { status: "clinical-attention", has: ["early-loss-over-10"] },
);
check(
  "no-regain by 3 weeks",
  verdictOf([w("2025-12-06", 3300), w("2025-12-24", 3400)], null, baby()),
  { status: "clinical-attention", has: ["no-regain-by-3w"] },
);

console.log("\n=== velocity → neutral info (does NOT color status, source-only) ===");
// Data fact: over a single WHO monthly interval, a velocity-z below ~−1.5 is
// reachable only when the child crosses a percentile corridor downward — and
// then corridor-drop (source-backed) sets the status, with velocity riding along
// as info. So "velocity z<−2 in pure isolation" is unreachable; we test what is
// actually reachable: low velocity-z WITHOUT a corridor drop (child holds its
// lower line) → on-track, velocity as info only.
// The pair 3450→4420 holds the corridor (band 4, drop 0), mv.z≈−1.49.
check(
  "velocity z≈−1.5 without corridor drop → on-track, info (not recheck)",
  verdictOf([w("2025-12-06", 3450), w("2025-12-30", 4420)]),
  {
    status: "on-track",
    has: ["velocity-low-mild"],
    lacks: ["corridor-drop-red", "corridor-drop-warn"],
    notRed: true,
    noClinical: true,
  },
);
// When velocity is genuinely low (z<−2) it always comes with a corridor drop, so
// the status is taken from corridor, not velocity. velocity-low-strong is present
// as info but does not drive the 🔴.
check(
  "deep drop: velocity-low-strong is info, status from corridor",
  verdictOf([w("2025-12-06", 3450), w("2025-12-29", 3700)]),
  { has: ["velocity-low-strong", "corridor-drop-red"], status: "clinical-attention" },
);

console.log("\n=== Neutral info (never a status) ===");
check(
  "9% loss → info, not yellow",
  verdictOf([w("2025-12-02", 3500), w("2025-12-06", 3190)]),
  { has: ["early-loss-near-10-info"], lacks: ["early-loss-over-10"], notRed: true },
);

console.log("\n=== fresh-deficit ===");
function greenBaby() {
  return [w("2025-12-06", 3600), w("2025-12-31", 5000)];
}
function feedingLink(days: FreshDay[], velocityZ: number | null): FeedingLink {
  return computeFeedingLink({ days, velocityZ });
}
// Green velocity + above-threshold deficit + window strictly after the interval.
// fresh-deficit is now info, so the status stays on-track (source-only).
check(
  "fresh-deficit-vs-stale-velocity → info, on-track",
  verdictOf(greenBaby(), feedingLink(freshDays(800, 600), 0.2)),
  { status: "on-track", has: ["fresh-deficit-vs-stale-velocity"], notRed: true },
);
// Small deficit → green, no signal
check(
  "green + small deficit → on-track",
  verdictOf(greenBaby(), feedingLink(freshDays(800, 780), 0.2)),
  { lacks: ["fresh-deficit-vs-stale-velocity"], notRed: true },
);
// velocity-unavailable + large deficit → neutral note, not the stale-velocity one
check(
  "vel-unavailable + deficit → neutral note",
  verdictOf([w("2025-12-06", 3600), w("2026-01-10", 5200)], feedingLink(freshDays(800, 600), null)),
  { has: ["fresh-deficit-neutral-info"], lacks: ["fresh-deficit-vs-stale-velocity"], notRed: true },
);
// <3 counted days → no signal
check(
  "<3 counted days → no signal",
  verdictOf(
    greenBaby(),
    feedingLink(
      [
        { dateISO: "2026-01-10", target: 800, factOfDay: 600 },
        { dateISO: "2026-01-11", target: null, factOfDay: 0 },
        { dateISO: "2026-01-12", target: null, factOfDay: 0 },
      ],
      0.2,
    ),
  ),
  { lacks: ["fresh-deficit-vs-stale-velocity", "fresh-deficit-neutral-info"] },
);

console.log("\n=== computeFeedingLink: relative threshold and hypotheses ===");
{
  const low = computeFeedingLink({ days: freshDays(400, 300), velocityZ: -1.5 }); // 25%
  const high = computeFeedingLink({ days: freshDays(1000, 750), velocityZ: -1.5 }); // 25%
  expect(
    "relative threshold is the same at 3kg and 7kg",
    low.fresh?.exceedsYellowThreshold === true && high.fresh?.exceedsYellowThreshold === true,
  );
  expect("hypothesis intake-likely-low", computeFeedingLink({ days: freshDays(800, 600), velocityZ: -1.5 }).hypothesis === "intake-likely-low");
  expect("hypothesis plan-held-no-growth", computeFeedingLink({ days: freshDays(800, 795), velocityZ: -1.5 }).hypothesis === "plan-held-no-growth");
  const guard = computeFeedingLink({ days: freshDays(0, 0), velocityZ: 0 });
  expect("avgTargetMl<=0 doesn't divide (no-axis)", guard.hypothesis === "no-axis" && guard.fresh?.exceedsYellowThreshold === false);
}

console.log("\n=== corridor-drop (real NICE signal) ===");
{
  // Grams that place a point just ABOVE percentile line p at a given age →
  // deterministic corridor membership.
  const gAtP = (sex: Sex, ageDays: number, p: number): number => {
    const kg = measurementFromZ(zFromPercentile(p), lookupWfaLMS(sex, ageDays));
    return Math.round(kg * 1000) + 8; // +8g to land safely >= the line
  };
  // Birth weight at a target percentile (day 0) sets the corridor threshold N.
  const birthAtP = (sex: Sex, p: number) => gAtP(sex, 0, p);

  // Ages around completed monthly intervals; corridor only needs the points.
  const d = (n: number) =>
    new Date(new Date(BIRTH).getTime() + n * 86400000)
      .toISOString()
      .slice(0, 10);

  // 7) birth P50 (threshold 2), drop P50→P25→P10 = 2 corridors → RED.
  check(
    "7) birth P50, dropped 2 corridors → corridor-drop-red 🔴",
    verdictOf(
      [
        w(d(28), gAtP("male", 28, 50)),
        w(d(56), gAtP("male", 56, 25)),
        w(d(84), gAtP("male", 84, 10)),
      ],
      null,
      baby({ birthWeightGrams: birthAtP("male", 50) }),
    ),
    { status: "clinical-attention", has: ["corridor-drop-red"] },
  );

  // 8) birth P50 (threshold 2), drop of 1 corridor (P50→P25) → corridor-drop-warn
  // is present, but it's an observation: status stays on-track (below the literal
  // NICE threshold of ≥2 corridors).
  check(
    "8) birth P50, dropped 1 corridor → warn as info, on-track",
    verdictOf(
      [w(d(28), gAtP("male", 28, 50)), w(d(56), gAtP("male", 56, 25))],
      null,
      baby({ birthWeightGrams: birthAtP("male", 50) }),
    ),
    { status: "on-track", has: ["corridor-drop-warn"], notRed: true, noClinical: true },
  );

  // 9) birth < P9 (threshold 1), drop of 1 corridor → RED (lower threshold).
  check(
    "9) birth <P9, dropped 1 corridor → corridor-drop-red 🔴",
    verdictOf(
      [w(d(28), gAtP("male", 28, 25)), w(d(56), gAtP("male", 56, 10))],
      null,
      baby({ birthWeightGrams: birthAtP("male", 5) }),
    ),
    { status: "clinical-attention", has: ["corridor-drop-red"] },
  );

  // 10) birth > P91 (threshold 3), drop of 2 corridors → warn as info (below the
  // red threshold of 3), status on-track.
  check(
    "10) birth >P91, dropped 2 corridors → warn as info, on-track",
    verdictOf(
      [
        w(d(28), gAtP("male", 28, 90)),
        w(d(56), gAtP("male", 56, 75)),
        w(d(84), gAtP("male", 84, 50)),
      ],
      null,
      baby({ birthWeightGrams: birthAtP("male", 97) }),
    ),
    { status: "on-track", has: ["corridor-drop-warn"], notRed: true, noClinical: true },
  );

  // 11) tracking along its own corridor (no drop) → no corridor signal.
  check(
    "11) along the corridor → no corridor signal",
    verdictOf(
      [
        w(d(28), gAtP("male", 28, 50)),
        w(d(56), gAtP("male", 56, 50)),
        w(d(84), gAtP("male", 84, 50)),
      ],
      null,
      baby({ birthWeightGrams: birthAtP("male", 50) }),
    ),
    { lacks: ["corridor-drop-red", "corridor-drop-warn"] },
  );
}

console.log("\n=== Invariant: only source-backed signals color the status ===");
{
  // velocity-info without a corridor drop → on-track (info doesn't color).
  check(
    "velocity-info (no corridor) keeps status 🟢",
    verdictOf([w("2025-12-06", 3450), w("2025-12-30", 4420)]),
    { status: "on-track", has: ["velocity-low-mild"], lacks: ["corridor-drop-warn"] },
  );
  // corridor-drop-warn (1-corridor drop) is our gradation, not a NICE threshold,
  // so it never colors the status. There is no source-backed 🟡 (YELLOW_CODES is
  // empty); only clinical thresholds color the status (see cases 8/10).
}

console.log("\n=== nextTargetWeighIn ===");
{
  const nb = nextTargetWeighIn({
    birthDate: new Date(BIRTH),
    tz: TZ,
    weighingDates: [],
    now: new Date("2025-12-12T10:00:00Z"),
  });
  expect("nearest boundary = early (day 14)", nb?.metric === "early-velocity" && nb?.ageDays === 14, JSON.stringify(nb));
}

// ---- summary ----
console.log(`\n${"=".repeat(40)}`);
console.log(`PASSED: ${passed}   FAILED: ${failed}`);
if (failed > 0) {
  console.log("\nFailed checks:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log("All checks passed.");
