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
import { dbConnect } from "../db/mongo.js";
import { FeedingModel } from "../models/feeding.js";
import { WeightModel } from "../models/weight.js";
import { resolveFormulaDensity } from "../lib/resolveFormulaDensity.js";
import type { AppEnv } from "../types.js";

export const historyRoute = new Hono<AppEnv>();

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 90;

historyRoute.get("/", async (c) => {
  const tz = c.get("tz");
  const baby = c.get("baby");
  const cursor = c.req.query("cursor") ?? localDateISO(new Date(), tz);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(c.req.query("limit") ?? DEFAULT_LIMIT)),
  );
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cursor)) {
    return c.json({ ok: false, error: "invalid_cursor" }, 400);
  }

  const babyId = new Types.ObjectId(baby._id);
  const babyBirthDate = new Date(baby.birthDate);

  // Build the (pure) day window first so the feeding query — which depends
  // only on it — can run in parallel with the formula/weights reads.
  const days: string[] = [];
  let d = cursor;
  const birthLocal = startOfLocalDay(localDateISO(babyBirthDate, tz), tz);
  for (let i = 0; i < limit; i++) {
    const dayStart = startOfLocalDay(d, tz);
    if (dayStart.getTime() < birthLocal.getTime()) break;
    days.push(d);
    d = addDaysISO(d, -1);
  }

  await dbConnect();
  // Preserve prior behavior: with no days in range, the feeding query never ran.
  const feedingsQuery =
    days.length > 0
      ? FeedingModel.find({
          babyId,
          startAt: {
            $gte: startOfLocalDay(days[days.length - 1], tz),
            $lt: endOfLocalDay(days[0], tz),
          },
        })
          .select("startAt endAt volumeMl isTopUp")
          .sort({ startAt: 1 })
          .lean()
      : Promise.resolve([] as Awaited<ReturnType<typeof FeedingModel.find>>);
  const [formulaDensity, weights, docs] = await Promise.all([
    resolveFormulaDensity(baby.currentFormulaId),
    WeightModel.find({ babyId }).select("date weightGrams").lean(),
    feedingsQuery,
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

  const items: {
    dateISO: string;
    dol: number;
    target: number | null;
    mode: "neonatal" | "energy";
    factOfDay: number;
    feedingsCount: number;
    topUpsCount: number;
    avgDurationMs: number | null;
    deficit: number | null;
  }[] = [];

  for (const dateISO of days) {
    const dayStart = startOfLocalDay(dateISO, tz);
    const facts = feedingsByDay.get(dateISO) ?? [];
    const babyPlan = {
      birthDate: babyBirthDate,
      birthWeightGrams: baby.birthWeightGrams,
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
    items.push({
      dateISO,
      dol: dayOfLife(babyBirthDate, dayStart, tz),
      target,
      mode,
      ...m,
    });
  }

  const nextCursor = days.length === limit ? d : null;
  return c.json({ items, nextCursor });
});
