import { localDateISO } from "@leon/domain/planning/dayBoundary";
import type { Baby } from "@leon/schemas/baby";
import { buildFeedingPlan } from "../lib/buildFeedingPlan.js";
import { selectNextReminderSlot } from "../lib/selectNextReminderSlot.js";
import { getReminderQueue } from "./queue.js";
import { REMINDER_OFFSET_MIN, jobIdForBaby } from "./constants.js";

const MS_PER_MIN = 60_000;

export type ReminderPayload = {
  babyId: string;
  tz: string;
  targetSlotISO: string;
  // Set by the debug enqueue endpoint to bypass fire-time plan re-validation,
  // so the job always delivers — used to smoke-test the queue→worker→push path.
  test?: boolean;
};

export type NextReminder = { fireAt: Date; targetSlot: Date };

/**
 * The next feeding moment (via the shared plan + selector) and when to fire its
 * reminder. `dateISO` is today-in-tz; `tomorrowSlot` (inside the plan) already
 * covers the overnight rollover, so no separate next-day query is needed.
 */
export async function computeNextReminderForBaby(
  baby: Baby,
  tz: string,
  now: Date = new Date(),
): Promise<NextReminder | null> {
  const dateISO = localDateISO(now, tz);
  const { result } = await buildFeedingPlan(baby, dateISO, tz);
  const targetSlot = selectNextReminderSlot(result.plan, now);
  if (!targetSlot) return null;
  const fireAt = new Date(targetSlot.getTime() - REMINDER_OFFSET_MIN * MS_PER_MIN);
  return { fireAt, targetSlot };
}

/**
 * Idempotent, eventually-consistent reschedule for one baby. Deterministic
 * jobId keyed on baby. Prefers changeDelay on an existing delayed job (single
 * op, no race window); falls back to remove-then-add. If there's no future
 * reminder, the job is removed. Replace is NOT atomic across concurrent CRUD —
 * worst case is one mistimed/lost reminder, self-healed on the next event.
 */
export async function rescheduleReminderForBaby(
  baby: Baby,
  tz: string,
  now: Date = new Date(),
): Promise<void> {
  const queue = getReminderQueue();
  if (!queue) {
    console.warn("[reminders] queue unavailable — reschedule skipped");
    return;
  }
  const babyId = baby._id;
  const jobId = jobIdForBaby(babyId);

  const next = await computeNextReminderForBaby(baby, tz, now);
  if (!next || next.fireAt.getTime() <= now.getTime()) {
    // Nothing to remind about (or it's already due) — clear any stale job.
    await queue.remove(jobId).catch(() => {});
    return;
  }

  const delay = next.fireAt.getTime() - now.getTime();
  const payload: ReminderPayload = {
    babyId,
    tz,
    targetSlotISO: next.targetSlot.toISOString(),
  };

  const existing = await queue.getJob(jobId);
  if (existing) {
    // Single-op delay change avoids the remove/add race window.
    try {
      await existing.changeDelay(delay);
      await existing.updateData(payload);
      return;
    } catch {
      // Job may have moved out of the delayed set — fall through to replace.
      await queue.remove(jobId).catch(() => {});
    }
  }

  await queue.add("remind", payload, {
    jobId,
    delay,
    removeOnComplete: true,
    // Keep recent failures for post-mortem via redis-cli (Principle 4).
    removeOnFail: { count: 50 },
  });
}
