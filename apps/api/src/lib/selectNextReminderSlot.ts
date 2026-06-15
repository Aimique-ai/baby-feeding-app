import type { RemainderPlan, Slot } from "@leon/domain/planning/types";

/**
 * The single source of "next feeding moment" for the plan response, the
 * scheduler's `fireAt`, and the worker's re-validate. Returns the whole Slot so
 * callers can read both the center (`time`, for display/drift) and the upper
 * bound (`windowEnd`, the reminder's fire instant). Never read `slots[0]`
 * directly — late evening yields `slots: []` while `tomorrowSlot` holds the
 * next (morning) feeding, so a slot-only read would silently drop overnight
 * reminders.
 */
export function selectNextReminderSlot(
  plan: RemainderPlan,
  now: Date,
): Slot | null {
  const nowMs = now.getTime();
  for (const slot of plan.slots) {
    if (slot.time.getTime() > nowMs) return slot;
  }
  return plan.tomorrowSlot ?? null;
}
