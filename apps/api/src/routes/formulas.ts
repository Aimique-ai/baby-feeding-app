import { Hono } from "hono";
import { dbConnect } from "../db/mongo.js";
import { FormulaModel } from "../models/formula.js";
import { serializeFormula } from "../lib/serializeFormula.js";

export const formulasRoute = new Hono();

formulasRoute.get("/", async (c) => {
  await dbConnect();
  const docs = await FormulaModel.find({ archivedAt: null })
    .sort({ name: 1 })
    .lean();
  return c.json(docs.map(serializeFormula));
});
