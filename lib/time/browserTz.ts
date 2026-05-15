"use client";

export const TZ_HEADER = "x-time-zone";

export function getBrowserTz(fallback = "Europe/Kyiv"): string {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return tz || fallback;
}

export function tzHeaders(fallback?: string): Record<string, string> {
  return { [TZ_HEADER]: getBrowserTz(fallback) };
}
