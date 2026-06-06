import type { RemainderPlan } from "@leon/domain/planning/types";

/**
 * The single source of "next feeding moment" for the plan response, the
 * scheduler's `fireAt`, and the worker's re-validate. Never read `slots[0]`
 * directly — late evening yields `slots: []` while `tomorrowSlot` holds the
 * next (morning) feeding, so a slot-only read would silently drop overnight
 * reminders.
 */
export function selectNextReminderSlot(
  plan: RemainderPlan,
  now: Date,
): Date | null {
  const nowMs = now.getTime();
  for (const slot of plan.slots) {
    if (slot.time.getTime() > nowMs) return slot.time;
  }
  return plan.tomorrowSlot?.time ?? null;
}
