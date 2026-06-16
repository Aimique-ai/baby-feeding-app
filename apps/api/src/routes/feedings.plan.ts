import { Hono } from "hono";
import type { FeedingPlanResponse } from "@leon/schemas/plan";
import { buildFeedingPlan } from "../lib/buildFeedingPlan.js";
import type { AppEnv } from "../types.js";

export const feedingsPlanRoute = new Hono<AppEnv>();

// Input assembly + engine run live in buildFeedingPlan (the single source
// shared with scheduler + worker); this route only serializes the result.
feedingsPlanRoute.get("/", async (c) => {
  const dateISO = c.req.query("date");
  if (!dateISO || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
    return c.json({ ok: false, error: "missing_or_invalid_date" }, 400);
  }
  const baby = c.get("baby");
  const tz = c.get("tz");

  const now = new Date();
  const { guidance, result } = await buildFeedingPlan(baby, dateISO, tz, now);
  const w = result.nextWindow;

  const body: FeedingPlanResponse = {
    tz,
    consumed: result.consumed,
    nextFeeding: w
      ? {
          timeISO: w.time.toISOString(),
          volumeMl: w.volumeMl,
          windowStartISO: w.windowStart.toISOString(),
          windowEndISO: w.windowEnd.toISOString(),
        }
      : null,
    guidance,
  };
  return c.json(body);
});
