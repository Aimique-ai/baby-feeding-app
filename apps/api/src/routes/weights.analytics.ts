import { Hono } from "hono";
import { Types } from "mongoose";
import {
  buildAnalytics,
  computeFeedingLink,
  computeGrowthVerdict,
  FRESH_WINDOW_DAYS,
  type FreshDay,
} from "@leon/domain/who";
import {
  addDaysISO,
  endOfLocalDay,
  localDateISO,
  startOfLocalDay,
} from "@leon/domain/planning/dayBoundary";
import { dayMetrics } from "@leon/domain/planning/metrics";
import { computeTarget } from "@leon/domain/planning/target";
import type { Feeding } from "@leon/domain/planning/types";
import { dbConnect } from "../db/mongo.js";
import { WeightModel } from "../models/weight.js";
import { FeedingModel } from "../models/feeding.js";
import { resolveFormulaDensity } from "../lib/resolveFormulaDensity.js";
import { serializeWeight } from "../lib/serializeFeeding.js";
import type { AppEnv } from "../types.js";

export const weightsAnalyticsRoute = new Hono<AppEnv>();

weightsAnalyticsRoute.get("/", async (c) => {
  const baby = c.get("baby");
  const tz = c.get("tz");
  await dbConnect();
  const docs = await WeightModel.find({
    babyId: new Types.ObjectId(baby._id),
  })
    .sort({ date: 1 })
    .lean();
  const weights = docs.map(serializeWeight);

  const analytics = buildAnalytics(baby, weights, tz);

  // Error-isolated join: the recent feeding-deficit window. Any failure reading
  // feedings/formula → feedingLink:null and the verdict stays weight-only.
  analytics.feedingLink = await buildFeedingLink(
    baby,
    tz,
    weights,
    analytics.monthlyVelocity?.z ?? null,
  ).catch(() => null);

  analytics.verdict = computeGrowthVerdict(analytics, analytics.feedingLink);

  return c.json(analytics);
});

async function buildFeedingLink(
  baby: AppEnv["Variables"]["baby"],
  tz: string,
  weights: { date: string; weightGrams: number }[],
  velocityZ: number | null,
) {
  // Fresh window: the last FRESH_WINDOW_DAYS full local days; today is excluded.
  const todayISO = localDateISO(new Date(), tz);
  const toDate = addDaysISO(todayISO, -1); // yesterday
  const fromDate = addDaysISO(toDate, -(FRESH_WINDOW_DAYS - 1));

  const window: string[] = [];
  for (let d = fromDate; d <= toDate; d = addDaysISO(d, 1)) window.push(d);

  const babyId = new Types.ObjectId(baby._id);
  const [formulaDensity, feedDocs] = await Promise.all([
    resolveFormulaDensity(baby.currentFormulaId),
    FeedingModel.find({
      babyId,
      startAt: {
        $gte: startOfLocalDay(fromDate, tz),
        $lt: endOfLocalDay(toDate, tz),
      },
    })
      .select("startAt endAt volumeMl isTopUp")
      .sort({ startAt: 1 })
      .lean(),
  ]);

  const feedingsByDay = new Map<string, Feeding[]>();
  for (const dateISO of window) feedingsByDay.set(dateISO, []);
  for (const doc of feedDocs) {
    const iso = localDateISO(doc.startAt, tz);
    const bucket = feedingsByDay.get(iso);
    if (!bucket) continue;
    bucket.push({
      _id: "",
      startAt: doc.startAt,
      endAt: doc.endAt ?? null,
      volumeMl: doc.volumeMl ?? null,
      isTopUp: doc.isTopUp,
    });
  }

  const babyPlan = {
    birthDate: new Date(baby.birthDate),
    birthWeightGrams: baby.birthWeightGrams,
  };
  const weightsPlan = weights.map((w) => ({
    date: new Date(w.date),
    weightGrams: w.weightGrams,
  }));

  const days: FreshDay[] = window.map((dateISO) => {
    const target = computeTarget(
      dateISO,
      babyPlan,
      weightsPlan,
      tz,
      formulaDensity,
    );
    const facts = feedingsByDay.get(dateISO) ?? [];
    const m = dayMetrics(facts, target);
    return { dateISO, target, factOfDay: m.factOfDay };
  });

  return computeFeedingLink({ days, velocityZ });
}
