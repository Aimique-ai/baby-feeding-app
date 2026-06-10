import {
  timersSnapshotSchema,
  timerStateSchema,
  timerStopSchema,
  type TimersSnapshot,
  type TimerStop,
} from "@leon/schemas/timer";
import { http } from "~/lib/http/client";

export async function startTimer(): Promise<{ startedAt: string }> {
  const res = await http.post("/api/feedings/timer/start");
  const state = timerStateSchema.parse(res.data);
  return { startedAt: state.startedAt ?? new Date().toISOString() };
}

export async function stopTimer(): Promise<TimerStop | null> {
  const res = await http.post("/api/feedings/timer/stop");
  if (res.data == null || res.data.startAt == null) return null;
  return timerStopSchema.parse(res.data);
}

export async function getAllTimers(): Promise<TimersSnapshot> {
  const res = await http.get("/api/timers/all");
  return timersSnapshotSchema.parse(res.data);
}

// EventSource takes a raw URL, so build it from the same base as the axios client.
export function timerStreamUrl(): string {
  const base = import.meta.env.VITE_API_URL ?? "";
  return `${base}/api/timers/stream`;
}
