export function getBrowserTz(fallback = "UTC"): string {
  if (typeof window === "undefined") return fallback;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return tz || fallback;
}
