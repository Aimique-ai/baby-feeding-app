import { Worker } from "bullmq";
import { getReminderConnection } from "./queue.js";
import { processReminder } from "./worker.js";
import { QUEUE_NAME } from "./constants.js";

let started = false;

/**
 * Start the in-process reminder worker. Co-located with EVERY long-running
 * serve() entrypoint — main.ts (Fly) AND server.ts (local dev, `tsx watch
 * src/server.ts`) — NEVER index.ts (Vercel serverless). Binding only to main.ts
 * would make delivery silently dead in local dev, where server.ts runs.
 */
export function startReminderWorker(): Worker | null {
  if (started) return null;
  const connection = getReminderConnection();
  if (!connection) {
    console.warn(
      "[reminders] REDIS_URL not set — reminder worker NOT started",
    );
    return null;
  }
  started = true;
  const worker = new Worker(QUEUE_NAME, processReminder, { connection });
  worker.on("failed", (job, err) => {
    console.error(
      `[reminders] job failed ${JSON.stringify({ jobId: job?.id })}`,
      err,
    );
  });
  console.log("[reminders] worker started");
  return worker;
}
