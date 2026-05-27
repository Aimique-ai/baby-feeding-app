
import * as React from "react";

const STORAGE_KEY = "leon:feedingTimer";

type StoredPayload = {
  startedAt: string;
  babyId: string;
};

type StopResult = {
  startAt: Date;
  durationMin: number;
};

export type FeedingTimer = {
  startedAt: Date | null;
  isRunning: boolean;
  start: () => void;
  stop: () => StopResult | null;
};

function readStored(): StoredPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPayload;
    if (typeof parsed.startedAt !== "string" || typeof parsed.babyId !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(payload: StoredPayload | null) {
  if (typeof window === "undefined") return;
  if (payload === null) {
    window.localStorage.removeItem(STORAGE_KEY);
  } else {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }
}

function subscribeStorage(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) cb();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

function getStartedAtSnapshot(): string | null {
  const stored = readStored();
  return stored ? stored.startedAt : null;
}

function getServerSnapshot(): string | null {
  return null;
}

export function useFeedingTimer(babyId: string | null): FeedingTimer {
  // Local "bump" state to force re-read of storage after start()/stop().
  const [, bump] = React.useReducer((x: number) => x + 1, 0);

  // Subscribe to cross-tab storage events; re-renders this hook on change.
  React.useSyncExternalStore(
    subscribeStorage,
    getStartedAtSnapshot,
    getServerSnapshot,
  );

  // Derive startedAt from storage, gated by babyId match.
  // If there's a definitive baby mismatch, eagerly clear storage during render
  // (idempotent — localStorage write is safe to repeat on re-renders).
  const stored = readStored();
  let startedAt: Date | null = null;
  if (stored) {
    if (babyId != null && stored.babyId !== babyId) {
      writeStored(null);
    } else {
      // While babyId is still resolving (null) or matches: expose timer.
      startedAt = new Date(stored.startedAt);
    }
  }

  const start = React.useCallback(() => {
    if (!babyId) return;
    const now = new Date();
    writeStored({ startedAt: now.toISOString(), babyId });
    bump();
  }, [babyId]);

  const stop = React.useCallback((): StopResult | null => {
    const current = readStored();
    if (!current) return null;
    const sa = new Date(current.startedAt);
    const now = new Date();
    // Defend against clock skew producing a future startAt.
    const safeStart =
      sa.getTime() > now.getTime() - 1000
        ? new Date(now.getTime() - 1000)
        : sa;
    const durationMin = Math.max(
      1,
      Math.round((now.getTime() - safeStart.getTime()) / 60000),
    );
    writeStored(null);
    bump();
    return { startAt: safeStart, durationMin };
  }, []);

  return {
    startedAt,
    isRunning: startedAt !== null,
    start,
    stop,
  };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${pad2(m)}:${pad2(s)}`;
  return `${pad2(m)}:${pad2(s)}`;
}

export function useElapsed(startedAt: Date | null): string {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!startedAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);
  if (!startedAt) return "00:00";
  return formatElapsed(now - startedAt.getTime());
}
