// Single home for scheduler tunables. For manual verification (§E phase 5),
// temporarily set REMINDER_OFFSET_MIN to 1–2 so a reminder fires within minutes.
export const REMINDER_OFFSET_MIN = 30;

// Worker re-validate tolerance: if the freshly-computed slot drifts more than
// this from the scheduled targetSlot, the reminder is treated as stale (the
// baby was fed / plan moved) and skipped.
export const TOLERANCE_MIN = 5;

export const QUEUE_NAME = "feeding-reminders";

// NB: BullMQ forbids ":" in custom job ids — use "-".
export function jobIdForBaby(babyId: string): string {
  return `reminder-${babyId}`;
}
