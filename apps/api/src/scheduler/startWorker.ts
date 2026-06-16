import { Worker, type Job } from "bullmq";
import { getReminderConnection, getReminderQueue } from "./queue.js";
import { processReminder } from "./worker.js";
import { processWeighInSweep } from "./weighInCron.js";
import {
  QUEUE_NAME,
  WEIGH_IN_SWEEP_JOB,
  WEIGH_IN_SWEEP_SCHEDULER,
} from "./constants.js";

let started = false;

// One queue carries both feeding-window reminders and the weigh-in sweep, so the
// worker dispatches on job name: the sweep is a repeatable calendar job, the rest
// are per-baby delayed feeding reminders.
async function dispatch(job: Job): Promise<void> {
  if (job.name === WEIGH_IN_SWEEP_JOB) {
    await processWeighInSweep(job);
    return;
  }
  await processReminder(job);
}

// Idempotent: upsert the hourly weigh-in sweep scheduler. Hourly because the
// per-subscription tz gate (fire on the first tick at/after WEIGH_IN_MIN_HOUR_LOCAL
// local) needs a tick every hour to catch each timezone's window.
async function ensureWeighInSweepScheduled(): Promise<void> {
  const queue = getReminderQueue();
  if (!queue) return;
  await queue.upsertJobScheduler(
    WEIGH_IN_SWEEP_SCHEDULER,
    { pattern: "0 * * * *" },
    { name: WEIGH_IN_SWEEP_JOB, opts: { removeOnComplete: true, removeOnFail: { count: 50 } } },
  );
}

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
  const worker = new Worker(QUEUE_NAME, dispatch, { connection });
  worker.on("failed", (job, err) => {
    console.error(
      `[reminders] job failed ${JSON.stringify({ jobId: job?.id })}`,
      err,
    );
  });
  void ensureWeighInSweepScheduled().catch((err) => {
    console.error("[reminders] failed to schedule weigh-in sweep", err);
  });
  console.log("[reminders] worker started");
  return worker;
}
