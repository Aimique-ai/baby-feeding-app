import { localDateISO } from "@leon/domain/planning/dayBoundary";
import type { Baby } from "@leon/schemas/baby";
import { buildFeedingPlan } from "../lib/buildFeedingPlan.js";
import { getReminderQueue } from "./queue.js";
import {
  REMINDER_LEAD_MIN,
  jobIdForBaby,
  type ReminderKind,
} from "./constants.js";

const MS_PER_MIN = 60_000;

export type ReminderPayload = {
  babyId: string;
  tz: string;
  kind: ReminderKind;
  targetSlotISO: string;
  // Set by the debug enqueue endpoint to bypass fire-time plan re-validation,
  // so the job always delivers — used to smoke-test the queue→worker→push path.
  test?: boolean;
};

export type NextReminder = { fireAt: Date; targetSlot: Date };

/**
 * The single next-feeding window and when to fire one edge of it. "start" fires
 * at `windowStart` (the window has opened — watch for hunger cues); "end" fires
 * at `windowEnd` (the safety net — too long since the last feed). Either way, if
 * the baby feeds within the window a reschedule moves the window and the reminder
 * never fires ("silence = success"). The window is anchored on the last full
 * feeding as raw instants, so it already spans midnight — no separate next-day
 * query is needed. `targetSlot` is the window's center (for the worker's drift
 * check + display).
 */
export async function computeNextReminderForBaby(
  baby: Baby,
  tz: string,
  kind: ReminderKind,
  now: Date = new Date(),
): Promise<NextReminder | null> {
  const dateISO = localDateISO(now, tz);
  const { result } = await buildFeedingPlan(baby, dateISO, tz, now);
  const w = result.nextWindow;
  if (!w) return null;
  const edge = kind === "start" ? w.windowStart : w.windowEnd;
  const fireAt = new Date(edge.getTime() - REMINDER_LEAD_MIN * MS_PER_MIN);
  return { fireAt, targetSlot: w.time };
}

/**
 * Reschedule both window-edge reminders ("start" + "end") for one baby. The two
 * are independent jobs, so a failure on one never blocks the other.
 */
export async function rescheduleRemindersForBaby(
  baby: Baby,
  tz: string,
  now: Date = new Date(),
): Promise<void> {
  await Promise.all([
    rescheduleReminderForBaby(baby, tz, "start", now),
    rescheduleReminderForBaby(baby, tz, "end", now),
  ]);
}

/**
 * Idempotent, eventually-consistent reschedule of one window-edge reminder for
 * one baby. Deterministic jobId keyed on (baby, kind). Prefers changeDelay on an
 * existing delayed job (single op, no race window); falls back to
 * remove-then-add. If there's no future reminder, the job is removed. Replace is
 * NOT atomic across concurrent CRUD — worst case is one mistimed/lost reminder,
 * self-healed on the next event.
 */
export async function rescheduleReminderForBaby(
  baby: Baby,
  tz: string,
  kind: ReminderKind,
  now: Date = new Date(),
): Promise<void> {
  const queue = getReminderQueue();
  if (!queue) {
    console.warn("[reminders] queue unavailable — reschedule skipped");
    return;
  }
  const babyId = baby._id;
  const jobId = jobIdForBaby(babyId, kind);

  const next = await computeNextReminderForBaby(baby, tz, kind, now);
  if (!next || next.fireAt.getTime() <= now.getTime()) {
    // Nothing to remind about (or it's already due) — clear any stale job.
    await queue.remove(jobId).catch(() => {});
    return;
  }

  const delay = next.fireAt.getTime() - now.getTime();
  const payload: ReminderPayload = {
    babyId,
    tz,
    kind,
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
