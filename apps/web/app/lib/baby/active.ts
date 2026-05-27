const KEY = "activeBabyId";

function notifySameTab(newValue: string | null) {
  if (typeof window === "undefined") return;
  // Same-tab notification: the native `storage` event does NOT fire in the
  // origin tab, only in other tabs. Dispatch a synthetic one so listeners
  // registered via useSyncExternalStore re-run.
  try {
    window.dispatchEvent(
      new StorageEvent("storage", { key: KEY, newValue }),
    );
  } catch {
    /* StorageEvent constructor may be unavailable in old environments */
  }
}

export function readActiveBabyId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(KEY);
    return v && /^[a-fA-F0-9]{24}$/.test(v) ? v : null;
  } catch {
    return null;
  }
}

export function writeActiveBabyId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, id);
    notifySameTab(id);
  } catch {
    /* localStorage unavailable */
  }
}

export function clearActiveBabyId(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
    notifySameTab(null);
  } catch {
    /* localStorage unavailable */
  }
}
