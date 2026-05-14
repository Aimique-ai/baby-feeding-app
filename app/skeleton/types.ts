/**
 * Pure types — safe to import from client components.
 * No server-only imports here.
 */
export type SkeletonFeeding = {
  id: string;
  startAt: string;
  volumeMl: number;
};

export const SKELETON_QUERY_KEY = ["feedings", "skeleton"] as const;
