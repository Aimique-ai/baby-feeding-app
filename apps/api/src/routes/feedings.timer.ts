import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { TimerEvent } from "@leon/schemas/timer";
import {
  getAllTimers,
  getTimer,
  startTimer,
  stopTimer,
} from "../timer/store.js";
import { broadcast, subscribe } from "../timer/hub.js";
import type { AppEnv } from "../types.js";

// 25s < Fly's ~60s idle-connection timeout.
const HEARTBEAT_MS = 25_000;

// Baby-scoped: active baby comes from x-active-baby-id via activeBaby middleware.
export const feedingsTimerRoute = new Hono<AppEnv>();

feedingsTimerRoute.post("/start", async (c) => {
  const baby = c.get("baby");
  const { startedAt } = await startTimer(baby._id);
  broadcast({ babyId: baby._id, type: "started", startedAt });
  return c.json({ startedAt });
});

feedingsTimerRoute.post("/stop", async (c) => {
  const baby = c.get("baby");
  const result = await stopTimer(baby._id);
  if (!result) return c.json({ startAt: null, durationMin: null }, 200);
  broadcast({ babyId: baby._id, type: "stopped" });
  return c.json(result);
});

feedingsTimerRoute.get("/", async (c) => {
  const baby = c.get("baby");
  const state = await getTimer(baby._id);
  return c.json({ startedAt: state?.startedAt ?? null });
});

// Header-less (EventSource can't send x-active-baby-id) and space-wide: /all and
// the stream return every baby's timer so a device on baby A still sees baby B.
export const timersPublicRoute = new Hono<AppEnv>();

timersPublicRoute.get("/all", async (c) => {
  const timers = await getAllTimers();
  return c.json(timers);
});

timersPublicRoute.get("/stream", (c) => {
  return streamSSE(c, async (stream) => {
    const unsubscribe = subscribe((event: TimerEvent) => {
      // Fire-and-forget so a slow socket can't block delivery to other listeners.
      void stream
        .writeSSE({ event: "timer", data: JSON.stringify(event) })
        .catch(() => {});
    });

    stream.onAbort(() => {
      unsubscribe();
    });

    await stream.writeSSE({ data: "", event: "ready" });

    while (!stream.aborted) {
      await stream.sleep(HEARTBEAT_MS);
      if (stream.aborted) break;
      await stream.writeSSE({ data: "", event: "ping" });
    }

    unsubscribe();
  });
});
