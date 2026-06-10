import type { TimerEvent } from "@leon/schemas/timer";

// In-memory fan-out for SSE streams. Single shared Set: the space is
// single-tenant, so listeners get every baby's events and filter by babyId.
// On globalThis so `tsx watch` reloads don't strand old subscribers.
//
// TODO(multi-instance): only fans out within one process. For >1 Fly machine,
// publish to Redis pub/sub and call broadcast() from a subscriber connection.

type Listener = (event: TimerEvent) => void;

const globalWithHub = globalThis as typeof globalThis & {
  _timerHub?: Set<Listener>;
};

const listeners: Set<Listener> = globalWithHub._timerHub ?? new Set<Listener>();
globalWithHub._timerHub = listeners;

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function broadcast(event: TimerEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // A closed stream must not stop delivery to the rest; its own close
      // handler removes the listener.
    }
  }
}
