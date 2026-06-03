import type { MonthlyVelocity } from "@leon/domain/who/types";

// Human-readable interval name + how long ago it ended, so a parent doesn't
// confuse the completed monthly interval with the latest weigh-in.

function ageDaysAt(iso: string, birthISO: string): number {
  const ms = new Date(iso).getTime() - new Date(birthISO).getTime();
  return Math.round(ms / (24 * 3600 * 1000));
}

// Month label, e.g. "1-й месяц". The exact day range is left off the prominent
// line to keep the verdict block light; the gain in grams already carries it.
export function velocityPeriodLabel(
  v: MonthlyVelocity,
  birthDateISO: string,
): string {
  const endDays = ageDaysAt(v.toDate, birthDateISO);
  const monthIndex = Math.max(1, Math.round(endDays / 30));
  return `${monthIndex}-й месяц`;
}

// How long ago the interval ended, relative to today in the local tz.
export function velocityRecency(v: MonthlyVelocity, todayISO: string): string {
  const days = diffDaysISO(todayISO, v.toDateISO);
  if (days <= 0) return "только что завершён";
  if (days === 1) return "завершён вчера";
  return `завершён ~${days} дн назад`;
}

function diffDaysISO(aISO: string, bISO: string): number {
  const [ay, am, ad] = aISO.split("-").map(Number);
  const [by, bm, bd] = bISO.split("-").map(Number);
  const a = Date.UTC(ay, am - 1, ad);
  const b = Date.UTC(by, bm - 1, bd);
  return Math.round((a - b) / (24 * 3600 * 1000));
}
