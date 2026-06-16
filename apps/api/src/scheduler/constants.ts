// Single home for scheduler tunables. The reminder is a safety net: it fires at
// the slot's windowEnd (the upper interval bound since the last feed), NOT before
// the center. REMINDER_LEAD_MIN shifts the fire instant earlier than windowEnd;
// 0 = fire exactly at the upper bound. For manual verification, seed a long-ago
// feed so the next windowEnd lands within minutes.
export const REMINDER_LEAD_MIN = 0;

// Worker re-validate tolerance: if the freshly-computed slot drifts more than
// this from the scheduled targetSlot, the reminder is treated as stale (the
// baby was fed / plan moved) and skipped.
export const TOLERANCE_MIN = 5;

export const QUEUE_NAME = "feeding-reminders";

// Two reminders bracket each feeding window: "start" fires at windowStart (the
// window has opened — watch for hunger cues, no call to act), "end" fires at
// windowEnd (too long since the last feed — the safety net).
export type ReminderKind = "start" | "end";

// NB: BullMQ forbids ":" in custom job ids — use "-". Each baby has one job per
// kind, so the two reminders reschedule independently and never collide.
export function jobIdForBaby(babyId: string, kind: ReminderKind): string {
  return `reminder-${kind}-${babyId}`;
}

// Weigh-in reminders are calendar-based (no feeding-style mutation to trigger a
// reschedule), so a single repeatable job sweeps all push subscriptions on a
// fixed hourly cadence. The sweep fires a baby's nudge on the FIRST tick where
// the subscription's local hour is >= WEIGH_IN_MIN_HOUR_LOCAL (a lower bound,
// not an exact hour) and the nudge hasn't been logged for the day. Lower-bound,
// not equality, so a user who subscribes after noon still gets today's nudge.
export const WEIGH_IN_SWEEP_JOB = "weigh-in-sweep";
export const WEIGH_IN_SWEEP_SCHEDULER = "weigh-in-sweep-scheduler";
export const WEIGH_IN_MIN_HOUR_LOCAL = 12;

// Same near-window the UI banner uses: surface a targeted WHO boundary from the
// day it lands through 3 days after.
export const WEIGH_IN_TARGET_WINDOW_DAYS = 3;
