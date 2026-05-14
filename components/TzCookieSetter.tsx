"use client";

import { useEffect } from "react";

/**
 * On first paint, write the user's IANA timezone to the `tz` cookie so
 * subsequent server renders use the precise zone instead of the
 * Europe/Kyiv fallback.
 */
export function TzCookieSetter() {
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return;
    const existing = document.cookie
      .split("; ")
      .find((c) => c.startsWith("tz="));
    if (existing && existing.slice(3) === tz) return;
    // 1 year, root path; SameSite=Lax is the default.
    document.cookie = `tz=${tz}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  }, []);
  return null;
}
