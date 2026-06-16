import type { Job } from "bullmq";
import { localDateISO } from "@leon/domain/planning/dayBoundary";
import { dbConnect } from "../db/mongo.js";
import { BabyModel } from "../models/baby.js";
import { serializeBaby } from "../lib/serializeBaby.js";
import { buildFeedingPlan } from "../lib/buildFeedingPlan.js";
import { sendPushToBaby } from "../push/webpush.js";
import { TOLERANCE_MIN } from "./constants.js";
import type { ReminderPayload } from "./reschedule.js";

const MS_PER_MIN = 60_000;

// Processor for a fired reminder. Re-validates the plan at fire time using the
// `tz` carried in the payload (Baby has no tz, and there's no request context
// here). Skips loudly-but-harmlessly if the baby was fed / plan moved (the slot
// drifted past TOLERANCE_MIN) or the slot is already in the past ("stale").
export async function processReminder(
  job: Job<ReminderPayload>,
): Promise<void> {
  const { babyId, tz, kind, targetSlotISO, test } = job.data;
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

  if (test) {
    await sendPushToBaby(babyId, {
      title: "Test",
      body: "Message",
      babyId,
      url: `/?baby=${babyId}`,
    });
    console.log(
      `[reminders] sent (test) ${JSON.stringify({ jobId: job.id, babyId })}`,
    );
    return;
  }

  const dateISO = localDateISO(now, tz);
  const { result } = await buildFeedingPlan(baby, dateISO, tz, now);
  const selected = result.nextWindow;

  // Re-validate against the freshly-computed window. Drift on the CENTER detects
  // "baby was fed within the window" — a feed moves the anchor so the window's
  // center diverges from the stored target by > TOLERANCE_MIN. The past-guard is
  // on windowEnd (NOT the fire instant) for BOTH kinds: once the window is over
  // the "end" reminder owns the moment, so a late-running "start" worker that
  // missed windowStart is simply expired rather than firing a stale "open" nudge.
  const target = new Date(targetSlotISO);
  const driftMin = selected
    ? Math.abs(selected.time.getTime() - target.getTime()) / MS_PER_MIN
    : Infinity;
  const expired =
    !!selected &&
    selected.windowEnd.getTime() <= now.getTime() - TOLERANCE_MIN * MS_PER_MIN;
  const stale = !selected || driftMin > TOLERANCE_MIN || expired;

  if (stale) {
    console.log(
      "[reminders] skipped, stale " +
        JSON.stringify({
          jobId: job.id,
          babyId,
          kind,
          targetSlotISO,
          selectedSlotISO: selected ? selected.time.toISOString() : null,
          reason: !selected ? "no-slot" : expired ? "expired" : "drift",
        }),
    );
    return;
  }

  const push =
    kind === "start"
      ? {
          title: `${baby.name}: приближается время кормления`,
          body: "Можно присмотреться к сигналам голода — жёсткого расписания нет, ориентируйтесь на ребёнка",
        }
      : {
          title: `${baby.name} давно не ел`,
          body: "Проверьте признаки голода — возможно, пора предложить бутылочку",
        };

  await sendPushToBaby(babyId, {
    ...push,
    babyId,
    url: `/?baby=${babyId}`,
  });
  console.log(
    `[reminders] sent ${JSON.stringify({ jobId: job.id, babyId, kind })}`,
  );
}
