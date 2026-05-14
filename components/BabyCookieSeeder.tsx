"use client";
import { useEffect } from "react";

export function BabyCookieSeeder({ babyId }: { babyId: string }) {
  useEffect(() => {
    const existing = document.cookie
      .split("; ")
      .find((c) => c.startsWith("activeBabyId="));
    if (existing && existing.slice("activeBabyId=".length) === babyId) return;
    document.cookie = `activeBabyId=${babyId}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  }, [babyId]);
  return null;
}
