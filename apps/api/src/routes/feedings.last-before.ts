import { Hono } from "hono";
import { Types } from "mongoose";
import { dbConnect } from "../db/mongo.js";
import { FeedingModel } from "../models/feeding.js";
import { serializeFeeding } from "../lib/serializeFeeding.js";
import type { AppEnv } from "../types.js";

export const feedingsLastBeforeRoute = new Hono<AppEnv>();

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 50;

feedingsLastBeforeRoute.get("/", async (c) => {
  const at = c.req.query("at");
  if (!at) {
    return c.json({ ok: false, error: "missing_at" }, 400);
  }
  const atDate = new Date(at);
  if (Number.isNaN(atDate.getTime())) {
    return c.json({ ok: false, error: "invalid_at" }, 400);
  }
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(c.req.query("limit") ?? DEFAULT_LIMIT)),
  );
  const baby = c.get("baby");
  await dbConnect();
  const docs = await FeedingModel.find({
    babyId: new Types.ObjectId(baby._id),
    startAt: { $lt: atDate },
  })
    .sort({ startAt: -1 })
    .limit(limit)
    .lean();
  return c.json(
    docs.map(serializeFeeding),
  );
});
