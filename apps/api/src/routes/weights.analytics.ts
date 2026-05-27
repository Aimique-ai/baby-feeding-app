import { Hono } from "hono";
import { Types } from "mongoose";
import { buildAnalytics } from "@leon/domain/who";
import { dbConnect } from "../db/mongo.js";
import { WeightModel } from "../models/weight.js";
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
  return c.json(buildAnalytics(baby, weights, tz));
});
