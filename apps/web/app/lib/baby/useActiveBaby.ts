import { useSyncExternalStore } from "react";
import { readActiveBabyId } from "./active";

const KEY = "activeBabyId";

function subscribe(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) cb();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

function getServerSnapshot(): string | null {
  return null;
}

/**
 * Active baby id, reactive across tabs (via `storage` events) and across the
 * single tab — components that mutate via `writeActiveBabyId` / `clearActiveBabyId`
 * also need to dispatch a synthetic `storage` event for the same-tab listener
 * to fire.
 */
export function useActiveBabyId(): string | null {
  return useSyncExternalStore(subscribe, readActiveBabyId, getServerSnapshot);
}
