import { getReminderConnection } from "../scheduler/queue.js";

const KEY_PREFIX = "feeding:timer:";
const MIN_DURATION_MIN = 1;

function keyFor(babyId: string): string {
  return `${KEY_PREFIX}${babyId}`;
}

function babyIdFromKey(key: string): string {
  return key.slice(KEY_PREFIX.length);
}

// Idempotent: an already-running timer keeps its startedAt so a double-tap or
// retry never resets the clock.
export async function startTimer(
  babyId: string,
): Promise<{ startedAt: string }> {
  const redis = getReminderConnection();
  if (!redis) return { startedAt: new Date().toISOString() };

  const key = keyFor(babyId);
  const existing = await redis.get(key);
  if (existing) return { startedAt: existing };

  const startedAt = new Date().toISOString();
  await redis.set(key, startedAt);
  return { startedAt };
}

// Duration is computed server-side (the server owns startedAt, so every device
// agrees). safeStartMs clamps a future startedAt to avoid negative durations.
export async function stopTimer(
  babyId: string,
): Promise<{ startAt: string; durationMin: number } | null> {
  const redis = getReminderConnection();
  if (!redis) return null;

  const key = keyFor(babyId);
  const startedAt = await redis.get(key);
  if (!startedAt) return null;
  await redis.del(key);

  const startMs = new Date(startedAt).getTime();
  const now = Date.now();
  const safeStartMs = startMs > now - 1000 ? now - 1000 : startMs;
  const durationMin = Math.max(
    MIN_DURATION_MIN,
    Math.round((now - safeStartMs) / 60000),
  );
  return { startAt: new Date(safeStartMs).toISOString(), durationMin };
}

export async function getTimer(
  babyId: string,
): Promise<{ startedAt: string } | null> {
  const redis = getReminderConnection();
  if (!redis) return null;
  const startedAt = await redis.get(keyFor(babyId));
  return startedAt ? { startedAt } : null;
}

// SCAN, not KEYS, to avoid blocking Redis.
export async function getAllTimers(): Promise<
  Array<{ babyId: string; startedAt: string }>
> {
  const redis = getReminderConnection();
  if (!redis) return [];

  const result: Array<{ babyId: string; startedAt: string }> = [];
  let cursor = "0";
  do {
    const [next, keys] = await redis.scan(
      cursor,
      "MATCH",
      `${KEY_PREFIX}*`,
      "COUNT",
      100,
    );
    cursor = next;
    if (keys.length > 0) {
      const values = await redis.mget(keys);
      keys.forEach((key, i) => {
        const startedAt = values[i];
        if (startedAt) {
          result.push({ babyId: babyIdFromKey(key), startedAt });
        }
      });
    }
  } while (cursor !== "0");

  return result;
}
