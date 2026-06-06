import type { Job } from "bullmq";
import { localDateISO } from "@leon/domain/planning/dayBoundary";
import { dbConnect } from "../db/mongo.js";
import { BabyModel } from "../models/baby.js";
import { serializeBaby } from "../lib/serializeBaby.js";
import { buildFeedingPlan } from "../lib/buildFeedingPlan.js";
import { selectNextReminderSlot } from "../lib/selectNextReminderSlot.js";
import { sendPushToBaby } from "../push/webpush.js";
import { TOLERANCE_MIN } from "./constants.js";
import type { ReminderPayload } from "./reschedule.js";

const MS_PER_MIN = 60_000;

// Processor for a fired reminder. Re-validates the plan at fire time using the
// `tz` carried in the payload (Baby has no tz, and there's no request context
// here). Skips loudly-but-harmlessly if the baby was fed / plan moved (the slot
// drifted past TOLERANCE_MIN) or the slot is already in the past ("stale").
export async function processReminder(job: Job<ReminderPayload>): Promise<void> {
  const { babyId, tz, targetSlotISO } = job.data;
  const now = new Date();

  await dbConnect();
  const doc = await BabyModel.findById(babyId).lean();
  if (!doc || doc.archivedAt != null) {
    console.log(
      `[reminders] skip — baby missing/archived ${JSON.stringify({ jobId: job.id, babyId })}`,
    );
    return;
  }
  const baby = serializeBaby(doc);

  const dateISO = localDateISO(now, tz);
  const { result } = await buildFeedingPlan(baby, dateISO, tz);
  const selected = selectNextReminderSlot(result.plan, now);

  const target = new Date(targetSlotISO);
  const driftMin = selected
    ? Math.abs(selected.getTime() - target.getTime()) / MS_PER_MIN
    : Infinity;
  const stale =
    !selected ||
    driftMin > TOLERANCE_MIN ||
    selected.getTime() <= now.getTime();

  if (stale) {
    console.log(
      "[reminders] skipped, stale " +
        JSON.stringify({
          jobId: job.id,
          babyId,
          targetSlotISO,
          selectedSlotISO: selected ? selected.toISOString() : null,
          reason: !selected
            ? "no-slot"
            : selected.getTime() <= now.getTime()
              ? "past"
              : "drift",
        }),
    );
    return;
  }

  await sendPushToBaby(babyId, {
    title: "Пора кормить",
    body: `${baby.name}: пора кормить`,
    babyId,
    url: `/?baby=${babyId}`,
  });
  console.log(
    `[reminders] sent ${JSON.stringify({ jobId: job.id, babyId })}`,
  );
}
