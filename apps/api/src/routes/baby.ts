import { Hono } from "hono";
import { serializeBabyWithFormula } from "../lib/serializeBabyWithFormula.js";
import type { AppEnv } from "../types.js";

export const babyRoute = new Hono<AppEnv>();

babyRoute.get("/", async (c) => {
  const baby = c.get("baby");
  return c.json(await serializeBabyWithFormula(baby));
});
