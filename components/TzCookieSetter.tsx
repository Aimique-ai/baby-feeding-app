"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getBrowserTz } from "@/lib/time/browserTz";

/**
 * On first paint, write the user's IANA timezone to the `tz` cookie so
 * subsequent server renders use the precise zone instead of the
 * Europe/Kyiv fallback.
 */
export function TzCookieSetter() {
  const router = useRouter();

  useEffect(() => {
    const tz = getBrowserTz();
    if (!tz) return;
    const existing = document.cookie
      .split("; ")
      .find((c) => c.startsWith("tz="))
      ?.slice(3);
    if (existing === tz) return;
    // 1 year, root path; SameSite=Lax is the default.
    document.cookie = `tz=${tz}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    router.refresh();
  }, [router]);
  return null;
}
