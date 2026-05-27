import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { Types } from "mongoose";
import { fromZonedTime } from "date-fns-tz";
import { weightPatchSchema, weightSchema } from "@leon/schemas/weight";
import { dbConnect } from "../db/mongo.js";
import { WeightModel } from "../models/weight.js";
import { serializeWeight } from "../lib/serializeFeeding.js";
import type { AppEnv } from "../types.js";

export const weightsRoute = new Hono<AppEnv>();

weightsRoute.get("/", async (c) => {
  const baby = c.get("baby");
  await dbConnect();
  const list = await WeightModel.find({
    babyId: new Types.ObjectId(baby._id),
  })
    .sort({ date: -1 })
    .lean();
  return c.json(
    list.map(serializeWeight),
  );
});

weightsRoute.post("/", zValidator("json", weightSchema), async (c) => {
  const baby = c.get("baby");
  const parsed = c.req.valid("json");
  const tz = c.get("tz");
  const date = fromZonedTime(`${parsed.dateISO}T00:00:00`, tz);
  await dbConnect();
  const updated = await WeightModel.findOneAndUpdate(
    {
      babyId: new Types.ObjectId(baby._id),
      date,
    },
    {
      $set: { weightGrams: parsed.weightGrams },
      $setOnInsert: {
        babyId: new Types.ObjectId(baby._id),
        date,
      },
    },
    { new: true, upsert: true },
  ).lean();
  if (!updated) throw new Error("weight_upsert_failed");
  return c.json(
    serializeWeight(updated),
    201,
  );
});

function isValidId(id: string): boolean {
  return Types.ObjectId.isValid(id);
}

weightsRoute.patch(
  "/:id",
  zValidator("json", weightPatchSchema),
  async (c) => {
    const id = c.req.param("id");
    if (!isValidId(id))
      return c.json({ ok: false, error: "weight_not_found" }, 404);
    const baby = c.get("baby");
    const parsed = c.req.valid("json");
    await dbConnect();
    const doc = await WeightModel.findById(id).lean();
    if (
      !doc ||
      !doc.babyId.equals(new Types.ObjectId(baby._id))
    )
      return c.json({ ok: false, error: "weight_not_found" }, 404);

    const set: { weightGrams?: number; date?: Date } = {};
    if (parsed.weightGrams !== undefined) set.weightGrams = parsed.weightGrams;
    if (parsed.dateISO !== undefined) {
      const tz = c.get("tz");
      set.date = fromZonedTime(`${parsed.dateISO}T00:00:00`, tz);
    }

    try {
      const updated = await WeightModel.findByIdAndUpdate(
        id,
        { $set: set },
        { new: true },
      ).lean();
      if (!updated)
        return c.json({ ok: false, error: "weight_not_found" }, 404);
      return c.json(serializeWeight(updated));
    } catch (err) {
      if (
        typeof err === "object" &&
        err !== null &&
        (err as { code?: number }).code === 11000
      ) {
        return c.json({ ok: false, error: "duplicate_date" }, 409);
      }
      throw err;
    }
  },
);

weightsRoute.delete("/:id", async (c) => {
  const id = c.req.param("id");
  if (!isValidId(id))
    return c.json({ ok: false, error: "weight_not_found" }, 404);
  const baby = c.get("baby");
  await dbConnect();
  const doc = await WeightModel.findById(id).lean();
  if (
    !doc ||
    !doc.babyId.equals(new Types.ObjectId(baby._id))
  )
    return c.json({ ok: false, error: "weight_not_found" }, 404);
  await WeightModel.findByIdAndDelete(id);
  return c.json({ ok: true });
});
