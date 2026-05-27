import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { Types } from "mongoose";
import {
  medicationPatchSchema,
  medicationSchema,
} from "@leon/schemas/medication";
import { dbConnect } from "../db/mongo.js";
import { MedicationModel } from "../models/medication.js";
import { serializeMedication } from "../lib/serializeFeeding.js";
import type { AppEnv } from "../types.js";

export const medicationsRoute = new Hono<AppEnv>();

medicationsRoute.get("/", async (c) => {
  const baby = c.get("baby");
  await dbConnect();
  const docs = await MedicationModel.find({
    babyId: new Types.ObjectId(baby._id),
    deletedAt: null,
  })
    .sort({ createdAt: 1 })
    .lean();
  return c.json(
    docs.map(serializeMedication),
  );
});

medicationsRoute.post("/", zValidator("json", medicationSchema), async (c) => {
  const baby = c.get("baby");
  const parsed = c.req.valid("json");
  await dbConnect();
  const existing = await MedicationModel.findOne({
    babyId: new Types.ObjectId(baby._id),
    deletedAt: null,
    name: parsed.name,
  })
    .collation({ locale: "en", strength: 2 })
    .lean();
  if (existing) {
    return c.json({ ok: false, error: "duplicate_name" }, 409);
  }
  const created = await MedicationModel.create({
    ...parsed,
    babyId: new Types.ObjectId(baby._id),
  });
  return c.json(
    serializeMedication(created.toObject()),
    201,
  );
});

function isValidId(id: string): boolean {
  return Types.ObjectId.isValid(id);
}

medicationsRoute.get("/:id", async (c) => {
  const id = c.req.param("id");
  if (!isValidId(id))
    return c.json({ ok: false, error: "medication_not_found" }, 404);
  const baby = c.get("baby");
  await dbConnect();
  const doc = await MedicationModel.findById(id).lean();
  if (
    !doc ||
    !doc.babyId.equals(new Types.ObjectId(baby._id))
  )
    return c.json({ ok: false, error: "medication_not_found" }, 404);
  return c.json(
    serializeMedication(doc),
  );
});

medicationsRoute.patch(
  "/:id",
  zValidator("json", medicationPatchSchema),
  async (c) => {
    const id = c.req.param("id");
    if (!isValidId(id))
      return c.json({ ok: false, error: "medication_not_found" }, 404);
    const baby = c.get("baby");
    const parsed = c.req.valid("json");
    await dbConnect();
    const doc = await MedicationModel.findById(id).lean();
    if (
      !doc ||
      !doc.babyId.equals(new Types.ObjectId(baby._id))
    )
      return c.json({ ok: false, error: "medication_not_found" }, 404);
    if (parsed.name !== undefined) {
      const collision = await MedicationModel.findOne({
        babyId: new Types.ObjectId(baby._id),
        deletedAt: null,
        name: parsed.name,
        _id: { $ne: new Types.ObjectId(id) },
      })
        .collation({ locale: "en", strength: 2 })
        .lean();
      if (collision) {
        return c.json({ ok: false, error: "duplicate_name" }, 409);
      }
    }
    const updated = await MedicationModel.findByIdAndUpdate(id, parsed, {
      new: true,
    }).lean();
    if (!updated)
      return c.json({ ok: false, error: "medication_not_found" }, 404);
    return c.json(serializeMedication(updated));
  },
);

medicationsRoute.delete("/:id", async (c) => {
  const id = c.req.param("id");
  if (!isValidId(id))
    return c.json({ ok: false, error: "medication_not_found" }, 404);
  const baby = c.get("baby");
  await dbConnect();
  const doc = await MedicationModel.findById(id).lean();
  if (
    !doc ||
    !doc.babyId.equals(new Types.ObjectId(baby._id))
  )
    return c.json({ ok: false, error: "medication_not_found" }, 404);
  const updated = await MedicationModel.findByIdAndUpdate(
    id,
    { deletedAt: new Date() },
    { new: true },
  );
  if (!updated)
    return c.json({ ok: false, error: "medication_not_found" }, 404);
  return c.json({ ok: true });
});
