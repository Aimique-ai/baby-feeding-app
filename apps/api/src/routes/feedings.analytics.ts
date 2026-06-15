import { Hono } from "hono";
import { Types } from "mongoose";
import {
  addDaysISO,
  dayOfLife,
  endOfLocalDay,
  localDateISO,
  startOfLocalDay,
} from "@leon/domain/planning/dayBoundary";
import { dayMetrics } from "@leon/domain/planning/metrics";
import { computeTarget, resolveMode } from "@leon/domain/planning/target";
import type { Feeding } from "@leon/domain/planning/types";
import type { FeedingsAnalyticsItem } from "@leon/schemas/analytics";
import { dbConnect } from "../db/mongo.js";
import { FeedingModel } from "../models/feeding.js";
import { WeightModel } from "../models/weight.js";
import { resolveFormulaDensity } from "../lib/resolveFormulaDensity.js";
import type { AppEnv } from "../types.js";

export const feedingsAnalyticsRoute = new Hono<AppEnv>();

const WINDOW_DAYS = 30;

feedingsAnalyticsRoute.get("/", async (c) => {
  const tz = c.get("tz");
  const baby = c.get("baby");
  const today = localDateISO(new Date(), tz);

  const babyId = new Types.ObjectId(baby._id);
  const babyBirthDate = new Date(baby.birthDate);
  const birthLocal = startOfLocalDay(localDateISO(babyBirthDate, tz), tz);

  const days: string[] = [];
  let d = today;
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const dayStart = startOfLocalDay(d, tz);
    if (dayStart.getTime() < birthLocal.getTime()) break;
    days.push(d);
    d = addDaysISO(d, -1);
  }
  days.reverse();

  if (days.length === 0) {
    return c.json({ tz, items: [] });
  }

  // Day window is pure (derived from today/birthDate/tz) so the feeding query
  // is independent of the formula/weights reads — run all three in parallel.
  const gte = startOfLocalDay(days[0], tz);
  const lt = endOfLocalDay(days[days.length - 1], tz);

  await dbConnect();
  const [formulaDensity, weights, docs] = await Promise.all([
    resolveFormulaDensity(baby.currentFormulaId),
    WeightModel.find({ babyId }).select("date weightGrams").lean(),
    FeedingModel.find({
      babyId,
      startAt: { $gte: gte, $lt: lt },
    })
      .select("startAt endAt volumeMl isTopUp")
      .sort({ startAt: 1 })
      .lean(),
  ]);
  const weightsPlan = weights.map((w) => ({
    date: w.date,
    weightGrams: w.weightGrams,
  }));

  const feedingsByDay = new Map<string, Feeding[]>();
  for (const dateISO of days) feedingsByDay.set(dateISO, []);

  for (const doc of docs) {
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

  const items: FeedingsAnalyticsItem[] = days.map((dateISO) => {
    const dayStart = startOfLocalDay(dateISO, tz);
    const facts = feedingsByDay.get(dateISO) ?? [];
    const babyPlan = {
      birthDate: babyBirthDate,
      birthWeightGrams: baby.birthWeightGrams,
      sex: baby.sex,
    };
    const mode = resolveMode(dateISO, babyPlan, weightsPlan, tz);
    const target = computeTarget(
      dateISO,
      babyPlan,
      weightsPlan,
      tz,
      formulaDensity,
    );
    const m = dayMetrics(facts, target);
    return {
      dateISO,
      dol: dayOfLife(babyBirthDate, dayStart, tz),
      target,
      mode,
      fact: m.factOfDay,
    };
  });

  return c.json({ tz, items });
});
