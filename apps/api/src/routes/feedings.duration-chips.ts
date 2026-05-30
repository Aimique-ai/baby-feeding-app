import { Hono } from "hono";
import { Types } from "mongoose";
import {
  DEFAULT_DURATION_CHIPS,
  computeDurationChips,
} from "@leon/domain/feeding";
import { FEEDING_DURATION_MAX_MIN } from "@leon/schemas/constants";
import type { DurationChips } from "@leon/schemas/analytics";
import { dbConnect } from "../db/mongo.js";
import { FeedingModel } from "../models/feeding.js";
import type { AppEnv } from "../types.js";

export const feedingsDurationChipsRoute = new Hono<AppEnv>();

const WINDOW_DAYS = 14;

feedingsDurationChipsRoute.get("/", async (c) => {
  const baby = c.get("baby");
  const gte = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  await dbConnect();
  const docs = (await FeedingModel.find({
    babyId: new Types.ObjectId(baby._id),
    startAt: { $gte: gte },
    endAt: { $ne: null },
  })
    .select("startAt endAt")
    .lean()) as { startAt: Date; endAt: Date }[];
  const durations = docs
    .map((d) => Math.round((d.endAt.getTime() - d.startAt.getTime()) / 60000))
    .filter((v) => v >= 1 && v <= FEEDING_DURATION_MAX_MIN);
  c.header("Cache-Control", "private, max-age=60");
  const body: DurationChips = {
    chips:
      durations.length > 0
        ? computeDurationChips(durations)
        : [...DEFAULT_DURATION_CHIPS],
  };
  return c.json(body);
});
