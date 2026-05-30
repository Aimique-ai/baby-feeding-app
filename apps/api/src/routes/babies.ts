import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { Types } from "mongoose";
import { babyPatchSchema, babySchema } from "@leon/schemas/baby";
import { dbConnect } from "../db/mongo.js";
import { BabyModel } from "../models/baby.js";
import { serializeBaby } from "../lib/serializeBaby.js";
import { formulaExists } from "../lib/assertFormulaExists.js";

export const babiesRoute = new Hono();

babiesRoute.get("/", async (c) => {
  const includeArchived = c.req.query("includeArchived") === "true";
  await dbConnect();
  const filter = includeArchived
    ? { archivedAt: { $ne: null } }
    : { archivedAt: null };
  const docs = await BabyModel.find(filter).sort({ createdAt: 1 }).lean();
  return c.json(docs.map(serializeBaby));
});

babiesRoute.post("/", zValidator("json", babySchema), async (c) => {
  const parsed = c.req.valid("json");
  await dbConnect();
  if (!(await formulaExists(parsed.currentFormulaId))) {
    return c.json({ ok: false, error: "formula_not_found" }, 404);
  }
  try {
    const created = await BabyModel.create(parsed);
    return c.json(serializeBaby(created.toObject()), 201);
  } catch (err) {
    if (
      typeof err === "object" &&
      err !== null &&
      (err as { code?: number }).code === 11000
    ) {
      return c.json({ ok: false, error: "duplicate_name" }, 409);
    }
    throw err;
  }
});

function isValidId(id: string): boolean {
  return Types.ObjectId.isValid(id);
}

babiesRoute.patch("/:id", zValidator("json", babyPatchSchema), async (c) => {
  const id = c.req.param("id");
  if (!isValidId(id))
    return c.json({ ok: false, error: "baby_not_found" }, 404);
  const parsed = c.req.valid("json");
  await dbConnect();
  if (
    "currentFormulaId" in parsed &&
    !(await formulaExists(parsed.currentFormulaId))
  ) {
    return c.json({ ok: false, error: "formula_not_found" }, 404);
  }
  const updated = await BabyModel.findByIdAndUpdate(id, parsed, {
    new: true,
  }).lean();
  if (!updated) return c.json({ ok: false, error: "baby_not_found" }, 404);
  return c.json(serializeBaby(updated));
});

babiesRoute.delete("/:id", async (c) => {
  const id = c.req.param("id");
  if (!isValidId(id))
    return c.json({ ok: false, error: "baby_not_found" }, 404);
  await dbConnect();
  const updated = await BabyModel.findOneAndUpdate(
    { _id: new Types.ObjectId(id), archivedAt: null },
    { archivedAt: new Date() },
    { new: true },
  );
  if (!updated) return c.json({ ok: false, error: "baby_not_found" }, 404);
  return c.json({ ok: true });
});

babiesRoute.post("/:id/restore", async (c) => {
  const id = c.req.param("id");
  if (!isValidId(id))
    return c.json({ ok: false, error: "baby_not_found" }, 404);
  await dbConnect();
  const updated = await BabyModel.findOneAndUpdate(
    { _id: new Types.ObjectId(id), archivedAt: { $ne: null } },
    { archivedAt: null },
    { new: true },
  ).lean();
  if (!updated) return c.json({ ok: false, error: "baby_not_found" }, 404);
  return c.json(serializeBaby(updated));
});
