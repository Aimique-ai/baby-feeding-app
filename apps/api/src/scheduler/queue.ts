import { Queue } from "bullmq";
import IORedis from "ioredis";
import { QUEUE_NAME } from "./constants.js";

// Singleton connection + queue, mirroring db/mongo.ts so we don't open a new
// Redis socket per request. Guarded by REDIS_URL: in a runtime without it
// (e.g. Vercel serverless) the queue is null and callers no-op — but that is a
// LOUD condition (boot ping + reschedule-hook log), never a silent death.
const REDIS_URL = process.env.REDIS_URL;

type QueueCache = {
  connection: IORedis | null;
  queue: Queue | null;
  pinged: boolean;
};

const globalWithQueue = globalThis as typeof globalThis & {
  _reminderQueue?: QueueCache;
};

const cached: QueueCache =
  globalWithQueue._reminderQueue ?? {
    connection: null,
    queue: null,
    pinged: false,
  };
globalWithQueue._reminderQueue = cached;

export function getReminderConnection(): IORedis | null {
  if (!REDIS_URL) return null;
  if (cached.connection) return cached.connection;
  cached.connection = new IORedis(REDIS_URL, {
    // Required by BullMQ.
    maxRetriesPerRequest: null,
  });
  return cached.connection;
}

export function getReminderQueue(): Queue | null {
  if (!REDIS_URL) return null;
  if (cached.queue) return cached.queue;
  const connection = getReminderConnection();
  if (!connection) return null;
  cached.queue = new Queue(QUEUE_NAME, { connection });
  return cached.queue;
}

// One-shot boot ping — surfaces an unreachable Redis loudly at startup rather
// than as a silently-dropped reminder hours later (Principle 4).
export async function pingReminderRedis(): Promise<void> {
  if (cached.pinged) return;
  cached.pinged = true;
  if (!REDIS_URL) {
    console.warn(
      "[reminders] REDIS_URL not set — reminder scheduling AND feeding timers DISABLED",
    );
    return;
  }
  const connection = getReminderConnection();
  try {
    await connection!.ping();
    console.log(
      "[reminders] Redis reachable — scheduling and feeding timers enabled",
    );
  } catch (err) {
    console.error(
      "[reminders] Redis unreachable at boot — scheduling DISABLED",
      err,
    );
  }
}
