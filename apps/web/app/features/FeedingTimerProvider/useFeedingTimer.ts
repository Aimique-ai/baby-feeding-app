import * as React from "react";
import type { TimerEvent } from "@leon/schemas/timer";
import {
  getAllTimers,
  startTimer as apiStartTimer,
  stopTimer as apiStopTimer,
  timerStreamUrl,
} from "~/lib/api/timer";

type StopResult = {
  startAt: Date;
  durationMin: number;
};

export type FeedingTimer = {
  startedAt: Date | null;
  isRunning: boolean;
  start: () => void;
  stop: () => Promise<StopResult | null>;
};

// All babies' running timers, keyed by babyId, fed by the server over one
// space-wide SSE stream (a device on baby A still needs baby B's timer). Server
// is the single source of truth; no localStorage fallback. external-store +
// useSyncExternalStore pattern, like lib/baby/active.ts but network-backed.
const timers = new Map<string, string>();
const listeners = new Set<() => void>();

let source: EventSource | null = null;
let refCount = 0;
let visibilityBound = false;

function emit() {
  for (const l of listeners) l();
}

function setTimerState(babyId: string, startedAt: string | null) {
  const prev = timers.get(babyId) ?? null;
  if (prev === startedAt) return;
  if (startedAt === null) timers.delete(babyId);
  else timers.set(babyId, startedAt);
  emit();
}

async function hydrate() {
  try {
    const snapshot = await getAllTimers();
    const next = new Set<string>();
    let changed = false;
    for (const { babyId, startedAt } of snapshot) {
      next.add(babyId);
      if (timers.get(babyId) !== startedAt) {
        timers.set(babyId, startedAt);
        changed = true;
      }
    }
    for (const babyId of timers.keys()) {
      if (!next.has(babyId)) {
        timers.delete(babyId);
        changed = true;
      }
    }
    if (changed) emit();
  } catch {
    // Offline: keep current state; SSE reconnect / next resync reconciles.
  }
}

function handleEvent(event: TimerEvent) {
  if (event.type === "started") {
    setTimerState(event.babyId, event.startedAt ?? new Date().toISOString());
  } else {
    setTimerState(event.babyId, null);
  }
}

function onVisibility() {
  if (document.visibilityState === "visible") void hydrate();
}

function openStream() {
  if (source || typeof window === "undefined") return;
  source = new EventSource(timerStreamUrl());
  source.addEventListener("timer", (e) => {
    try {
      handleEvent(JSON.parse((e as MessageEvent).data) as TimerEvent);
    } catch {
      // Ignore malformed payload; next resync corrects state.
    }
  });
  // Resync on (re)connect to recover events missed while disconnected.
  source.addEventListener("open", () => {
    void hydrate();
  });
}

function closeStream() {
  source?.close();
  source = null;
}

// Ref-counted: stream + visibility listener live only while a component subscribes.
function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  refCount += 1;
  if (refCount === 1) {
    openStream();
    void hydrate();
    if (!visibilityBound && typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
      visibilityBound = true;
    }
  }
  return () => {
    listeners.delete(cb);
    refCount -= 1;
    if (refCount === 0) {
      closeStream();
      if (visibilityBound && typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
        visibilityBound = false;
      }
    }
  };
}

// Returns a primitive so useSyncExternalStore's Object.is check stays stable.
function getStartedAtSnapshot(babyId: string | null): string | null {
  if (babyId == null) return null;
  return timers.get(babyId) ?? null;
}

export function useFeedingTimer(babyId: string | null): FeedingTimer {
  const subscribeStore = React.useCallback(
    (cb: () => void) => subscribe(cb),
    [],
  );
  const getSnapshot = React.useCallback(
    () => getStartedAtSnapshot(babyId),
    [babyId],
  );
  const startedAtISO = React.useSyncExternalStore(
    subscribeStore,
    getSnapshot,
    () => null,
  );

  const startedAt = React.useMemo(
    () => (startedAtISO ? new Date(startedAtISO) : null),
    [startedAtISO],
  );

  const start = React.useCallback(() => {
    if (!babyId) return;
    // Optimistic; the SSE "started" event confirms with the server startedAt.
    setTimerState(babyId, new Date().toISOString());
    void apiStartTimer().then(
      ({ startedAt }) => setTimerState(babyId, startedAt),
      () => setTimerState(babyId, null),
    );
  }, [babyId]);

  const stop = React.useCallback(async (): Promise<StopResult | null> => {
    if (!babyId) return null;
    const result = await apiStopTimer();
    setTimerState(babyId, null);
    if (!result) return null;
    return {
      startAt: new Date(result.startAt),
      durationMin: result.durationMin,
    };
  }, [babyId]);

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
