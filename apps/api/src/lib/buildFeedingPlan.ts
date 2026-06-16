import { Types } from "mongoose";
import { startOfLocalDay } from "@leon/domain/planning/dayBoundary";
import { dayRangeUtc } from "@leon/domain/time";
import { computeFeedingGuidance } from "@leon/domain/planning/target";
import { runPipeline, type PipelineResult } from "@leon/domain/planning/pipeline";
import { anchorMinMl } from "@leon/domain/planning";
import type { Feeding, FeedingTarget } from "@leon/domain/planning/types";
import type { Baby } from "@leon/schemas/baby";
import { dbConnect } from "../db/mongo.js";
import { FeedingModel } from "../models/feeding.js";
import { WeightModel } from "../models/weight.js";
import { resolveFormulaDensity } from "./resolveFormulaDensity.js";

export type BuildFeedingPlanResult = {
  guidance: FeedingTarget;
  result: PipelineResult;
};

/**
 * The single source for assembling planning inputs and running the engine.
 * Called by the plan route, the scheduler, and the worker — nowhere else should
 * inputs be gathered or `runPipeline` invoked. `baby` is the serialized context
 * shape (ISO `birthDate`, string `currentFormulaId`); we deserialize internally.
 * `now` is threaded into the engine's staleness guard.
 */
export async function buildFeedingPlan(
  baby: Baby,
  dateISO: string,
  tz: string,
  now: Date,
): Promise<BuildFeedingPlanResult> {
  const babyId = new Types.ObjectId(baby._id);
  const birthDate = new Date(baby.birthDate);
  const { gte, lt } = dayRangeUtc(dateISO, tz);
  const dayStart = startOfLocalDay(dateISO, tz);

  await dbConnect();
  const [formulaDensity, weightDocs, dayDocs] = await Promise.all([
    resolveFormulaDensity(baby.currentFormulaId),
    WeightModel.find({ babyId }).select("date weightGrams").lean(),
    FeedingModel.find({ babyId, startAt: { $gte: gte, $lt: lt } })
      .sort({ startAt: 1 })
      .lean(),
  ]);

  const weights = weightDocs.map((w) => ({
    date: w.date,
    weightGrams: w.weightGrams,
  }));

  const guidance = computeFeedingGuidance(
    dateISO,
    { birthDate, birthWeightGrams: baby.birthWeightGrams, sex: baby.sex },
    weights,
    tz,
    formulaDensity,
  );

  // The volume floor below which a feeding does not move the window anchor.
  // Pushing it into the query lets us fetch the prev-day anchor in one shot — the
  // most recent qualifying feeding before today. A feeding with no recorded
  // volume (breast, "по режиму") always qualifies.
  const minMl =
    guidance.mode === "energy"
      ? anchorMinMl({
          range: guidance.feedCountRange,
          target: guidance.dailyMl,
        })
      : anchorMinMl({ perFeedMl: guidance.perFeedMlRange[0] });

  const prevAnchorDoc = await FeedingModel.findOne({
    babyId,
    startAt: { $lt: dayStart },
    $or: [{ volumeMl: { $gte: minMl } }, { volumeMl: null }],
  })
    .sort({ startAt: -1 })
    .lean();

  const toFeeding = (doc: (typeof dayDocs)[number]): Feeding => ({
    _id: doc._id.toString(),
    startAt: doc.startAt,
    endAt: doc.endAt ?? null,
    volumeMl: doc.volumeMl ?? null,
    isTopUp: doc.isTopUp,
  });
  const facts = dayDocs.map(toFeeding);
  const prevAnchor = prevAnchorDoc ? toFeeding(prevAnchorDoc) : null;

  const result =
    guidance.mode === "energy"
      ? runPipeline(
          {
            mode: "energy",
            facts,
            target: guidance.dailyMl,
            dateISO,
            tz,
            range: guidance.feedCountRange,
            prevAnchor,
          },
          now,
        )
      : runPipeline(
          {
            mode: "neonatal",
            facts,
            perFeedRange: guidance.perFeedMlRange,
            dateISO,
            tz,
            range: guidance.feedCountRange,
            prevAnchor,
          },
          now,
        );

  return { guidance, result };
}
