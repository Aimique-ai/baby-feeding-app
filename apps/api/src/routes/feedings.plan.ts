import { Hono } from "hono";
import type { FeedingPlanResponse } from "@leon/schemas/plan";
import { buildFeedingPlan } from "../lib/buildFeedingPlan.js";
import { selectNextReminderSlot } from "../lib/selectNextReminderSlot.js";
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

  const { guidance, result } = await buildFeedingPlan(baby, dateISO, tz);
  const plan = result.plan;
  const now = new Date();
  const nextFeeding = selectNextReminderSlot(plan, now);

  const body: FeedingPlanResponse = {
    tz,
    consumed: result.consumed,
    slots: plan.slots.map((s) => ({
      timeISO: s.time.toISOString(),
      volumeMl: s.volumeMl,
      windowStartISO: s.windowStart.toISOString(),
      windowEndISO: s.windowEnd.toISOString(),
    })),
    tomorrowSlot: plan.tomorrowSlot
      ? {
          timeISO: plan.tomorrowSlot.time.toISOString(),
          volumeMl: plan.tomorrowSlot.volumeMl,
          windowStartISO: plan.tomorrowSlot.windowStart.toISOString(),
          windowEndISO: plan.tomorrowSlot.windowEnd.toISOString(),
        }
      : null,
    nextFeedingISO: nextFeeding ? nextFeeding.time.toISOString() : null,
    guidance,
  };
  return c.json(body);
});
