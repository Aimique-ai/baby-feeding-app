import { dbConnect } from "@/lib/mongodb";
import type { SkeletonFeeding } from "./types";

/**
 * Server-only fetcher. Imported only by RSC and Route Handlers.
 * Phase 7 will replace this with a real Feeding model query.
 */
export async function fetchSkeletonFeedings(): Promise<SkeletonFeeding[]> {
  await dbConnect();
  return [
    {
      id: "skeleton-1",
      startAt: new Date("2026-05-09T08:00:00.000Z").toISOString(),
      volumeMl: 80,
    },
  ];
}
