import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { Types } from "mongoose";
import { feedingPatchSchema, feedingSchema } from "@leon/schemas/feeding";
import { dayRangeUtc } from "@leon/domain/time";
import { dbConnect } from "../db/mongo.js";
import { FeedingModel } from "../models/feeding.js";
import { MedicationModel } from "../models/medication.js";
import { serializeFeeding } from "../lib/serializeFeeding.js";
import { rescheduleRemindersForBaby } from "../scheduler/reschedule.js";
import type { Baby } from "@leon/schemas/baby";
import type { AppEnv } from "../types.js";

export const feedingsRoute = new Hono<AppEnv>();

// Reschedule the baby's reminder after a feeding mutation. Failures here must
// NOT fail the API response (the mutation already succeeded). The loud,
// uniquely-prefixed error makes a silent miss visible — most likely cause is
// Redis down or the WRONG RUNTIME (Vercel has no worker/Redis); see Risk 1.
async function safeReschedule(baby: Baby, tz: string): Promise<void> {
  try {
    await rescheduleRemindersForBaby(baby, tz);
  } catch (err) {
    console.error(
      "[reminders] reschedule failed — Redis down or WRONG RUNTIME (Vercel?)",
      err,
    );
  }
}

feedingsRoute.get("/", async (c) => {
  const dateISO = c.req.query("date");
  if (!dateISO || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
    return c.json({ ok: false, error: "missing_or_invalid_date" }, 400);
  }
  const baby = c.get("baby");
  const tz = c.get("tz");
  const { gte, lt } = dayRangeUtc(dateISO, tz);
  await dbConnect();
  const docs = await FeedingModel.find({
    babyId: new Types.ObjectId(baby._id),
    startAt: { $gte: gte, $lt: lt },
  })
    .sort({ startAt: 1 })
    .lean();
  return c.json(docs.map(serializeFeeding));
});

feedingsRoute.post("/", zValidator("json", feedingSchema), async (c) => {
  const baby = c.get("baby");
  const parsed = c.req.valid("json");
  await dbConnect();
  const data = { ...parsed, babyId: new Types.ObjectId(baby._id) };
  if (data.medicationId) {
    const med = await MedicationModel.findById(data.medicationId).lean();
    if (!med || !med.babyId.equals(new Types.ObjectId(baby._id))) {
      return c.json({ ok: false, error: "cross_baby_reference" }, 400);
    }
  }
  const created = await FeedingModel.create(data);
  await safeReschedule(baby, c.get("tz"));
  return c.json(serializeFeeding(created.toObject()), 201);
});

function isValidId(id: string): boolean {
  return Types.ObjectId.isValid(id);
}

feedingsRoute.patch(
  "/:id",
  zValidator("json", feedingPatchSchema),
  async (c) => {
    const id = c.req.param("id");
    if (!isValidId(id))
      return c.json({ ok: false, error: "feeding_not_found" }, 404);
    const baby = c.get("baby");
    const parsed = c.req.valid("json");
    await dbConnect();
    const doc = await FeedingModel.findById(id).lean();
    if (!doc || !doc.babyId.equals(new Types.ObjectId(baby._id)))
      return c.json({ ok: false, error: "feeding_not_found" }, 404);

    if (parsed.medicationId) {
      const med = await MedicationModel.findById(parsed.medicationId).lean();
      if (!med || !med.babyId.equals(new Types.ObjectId(baby._id))) {
        return c.json({ ok: false, error: "cross_baby_reference" }, 400);
      }
    }

    const updated = await FeedingModel.findByIdAndUpdate(id, parsed, {
      new: true,
    }).lean();
    if (!updated) return c.json({ ok: false, error: "feeding_not_found" }, 404);
    await safeReschedule(baby, c.get("tz"));
    return c.json(serializeFeeding(updated));
  },
);

feedingsRoute.delete("/:id", async (c) => {
  const id = c.req.param("id");
  if (!isValidId(id))
    return c.json({ ok: false, error: "feeding_not_found" }, 404);
  const baby = c.get("baby");
  await dbConnect();
  const doc = await FeedingModel.findById(id).lean();
  if (!doc || !doc.babyId.equals(new Types.ObjectId(baby._id)))
    return c.json({ ok: false, error: "feeding_not_found" }, 404);
  await FeedingModel.findByIdAndDelete(id);
  await safeReschedule(baby, c.get("tz"));
  return c.json({ ok: true });
});
