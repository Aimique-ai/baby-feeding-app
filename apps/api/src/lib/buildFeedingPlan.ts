import { Types } from "mongoose";
import { startOfLocalDay } from "@leon/domain/planning/dayBoundary";
import { dayRangeUtc } from "@leon/domain/time";
import { computeFeedingGuidance } from "@leon/domain/planning/target";
import { runPipeline, type PipelineResult } from "@leon/domain/planning/pipeline";
import type { Feeding, FeedingTarget } from "@leon/domain/planning/types";
import type { Baby } from "@leon/schemas/baby";
import { dbConnect } from "../db/mongo.js";
import { FeedingModel } from "../models/feeding.js";
import { WeightModel } from "../models/weight.js";
import { resolveFormulaDensity } from "./resolveFormulaDensity.js";

// prevMainCandidates contract — pinned to match the legacy client path exactly:
// GET /api/feedings/last-before?at=<dayStart>&limit=5 (boundary strictly `<`,
// default limit 5). Drift here would desync server plan from the old client plan.
const PREV_MAIN_LIMIT = 5;

export type BuildFeedingPlanResult = {
  guidance: FeedingTarget;
  result: PipelineResult;
};

/**
 * The single source for assembling planning inputs and running the engine.
 * Called by the plan route, the scheduler, and the worker — nowhere else should
 * inputs be gathered or `runPipeline` invoked. `baby` is the serialized context
 * shape (ISO `birthDate`, string `currentFormulaId`); we deserialize internally.
 */
export async function buildFeedingPlan(
  baby: Baby,
  dateISO: string,
  tz: string,
): Promise<BuildFeedingPlanResult> {
  const babyId = new Types.ObjectId(baby._id);
  const birthDate = new Date(baby.birthDate);
  const { gte, lt } = dayRangeUtc(dateISO, tz);
  const dayStart = startOfLocalDay(dateISO, tz);

  await dbConnect();
  const [formulaDensity, weightDocs, dayDocs, prevDocs] = await Promise.all([
    resolveFormulaDensity(baby.currentFormulaId),
    WeightModel.find({ babyId }).select("date weightGrams").lean(),
    FeedingModel.find({ babyId, startAt: { $gte: gte, $lt: lt } })
      .sort({ startAt: 1 })
      .lean(),
    FeedingModel.find({ babyId, startAt: { $lt: dayStart } })
      .sort({ startAt: -1 })
      .limit(PREV_MAIN_LIMIT)
      .lean(),
  ]);

  const weights = weightDocs.map((w) => ({
    date: w.date,
    weightGrams: w.weightGrams,
  }));

  const toFeeding = (doc: (typeof dayDocs)[number]): Feeding => ({
    _id: doc._id.toString(),
    startAt: doc.startAt,
    endAt: doc.endAt ?? null,
    volumeMl: doc.volumeMl ?? null,
    isTopUp: doc.isTopUp,
  });
  const facts = dayDocs.map(toFeeding);
  const prevMainCandidates = prevDocs.map(toFeeding);

  const guidance = computeFeedingGuidance(
    dateISO,
    { birthDate, birthWeightGrams: baby.birthWeightGrams, sex: baby.sex },
    weights,
    tz,
    formulaDensity,
  );

  const result =
    guidance.mode === "energy"
      ? runPipeline({
          mode: "energy",
          facts,
          target: guidance.dailyMl,
          dateISO,
          tz,
          range: guidance.feedCountRange,
          birthDate,
          prevMainCandidates,
        })
      : runPipeline({
          mode: "neonatal",
          facts,
          perFeedRange: guidance.perFeedMlRange,
          dateISO,
          tz,
          range: guidance.feedCountRange,
          birthDate,
          prevMainCandidates,
        });

  return { guidance, result };
}
