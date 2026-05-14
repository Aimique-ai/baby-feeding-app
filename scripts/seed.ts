/**
 * Seed: baby (Леон), initial weights, and 1–8 мая feeding history.
 *
 * Usage:
 *   pnpm seed              # idempotent: skip-if-exists
 *   pnpm seed --reset      # wipe baby/weights/feedings, then seed
 *
 * Times in this file are written in Europe/Kyiv local (UTC+3 in May).
 * Births dates per PRD §2.1: Леон, 2026-04-25, 3400 g.
 */
import mongoose, { Types } from "mongoose";
import { fromZonedTime } from "date-fns-tz";
import { dbConnect } from "../lib/mongodb";
import { BabyModel } from "../models/baby";
import { WeightModel } from "../models/weight";
import { FeedingModel } from "../models/feeding";

const BABY_NAME = "Леон";
const TZ = "Europe/Kyiv";
// 00:00 Kyiv on 2026-04-25
const BIRTH_DATE = fromZonedTime("2026-04-25T00:00:00", TZ);
const BIRTH_WEIGHT_GRAMS = 3400;
const FEEDINGS_PER_DAY = 8;

/**
 * Convert a Kyiv-local "YYYY-MM-DDTHH:mm" wall-clock into a UTC Date.
 */
function k(localISO: string): Date {
  return fromZonedTime(localISO, TZ);
}

type FeedSpec = {
  ref?: string; // optional id-string for top-up parent linking
  parent?: string; // ref of parent feeding (makes this a top-up)
  startAt: string; // Kyiv local
  endAt?: string; // Kyiv local, optional
  volumeMl: number | null;
};

/**
 * History 1–8 May (May = Kyiv UTC+3).
 *
 * Конвенция: «след. 03:00» из источника — это плановая отметка, не запись.
 * В БД сохраняем только фактические кормления и докормы. Каждый докорм
 * привязан к родительскому feeding через parentFeedingId.
 */
const HISTORY: FeedSpec[] = [
  // ── 1 мая (7 день)
  { startAt: "2026-05-01T01:45", volumeMl: 75 },
  { startAt: "2026-05-01T05:00", endAt: "2026-05-01T05:20", volumeMl: 65 },
  { startAt: "2026-05-01T08:00", endAt: "2026-05-01T08:12", volumeMl: 70 },
  { startAt: "2026-05-01T11:25", endAt: "2026-05-01T11:40", volumeMl: 78 },
  { startAt: "2026-05-01T15:05", endAt: "2026-05-01T15:25", volumeMl: 63 },
  { startAt: "2026-05-01T18:30", endAt: "2026-05-01T18:52", volumeMl: 78 },
  { startAt: "2026-05-01T22:00", endAt: "2026-05-01T22:15", volumeMl: 80 },

  // ── 2 мая (8 день)
  { startAt: "2026-05-02T01:35", endAt: "2026-05-02T01:50", volumeMl: 70 },
  { startAt: "2026-05-02T04:00", endAt: "2026-05-02T04:20", volumeMl: 66 },
  { startAt: "2026-05-02T07:20", endAt: "2026-05-02T07:35", volumeMl: 78 },
  { startAt: "2026-05-02T11:10", endAt: "2026-05-02T11:35", volumeMl: 75 },
  { startAt: "2026-05-02T15:00", endAt: "2026-05-02T15:15", volumeMl: 65 },
  { startAt: "2026-05-02T17:48", endAt: "2026-05-02T18:00", volumeMl: 80 },
  { startAt: "2026-05-02T21:30", endAt: "2026-05-02T21:43", volumeMl: 80 },

  // ── 3 мая (9 день)
  { startAt: "2026-05-03T00:00", endAt: "2026-05-03T00:12", volumeMl: 85 },
  { startAt: "2026-05-03T03:15", endAt: "2026-05-03T03:25", volumeMl: 68 },
  { startAt: "2026-05-03T07:05", endAt: "2026-05-03T07:23", volumeMl: 78 },
  { startAt: "2026-05-03T10:25", endAt: "2026-05-03T10:40", volumeMl: 63 },
  {
    ref: "0503-1315",
    startAt: "2026-05-03T13:15",
    endAt: "2026-05-03T13:25",
    volumeMl: 55,
  },
  { parent: "0503-1315", startAt: "2026-05-03T13:55", volumeMl: 15 },
  { startAt: "2026-05-03T16:30", endAt: "2026-05-03T16:40", volumeMl: 70 },
  { startAt: "2026-05-03T18:10", endAt: "2026-05-03T18:15", volumeMl: 25 },
  {
    ref: "0503-1930",
    startAt: "2026-05-03T19:30",
    endAt: "2026-05-03T19:46",
    volumeMl: 65,
  },
  { parent: "0503-1930", startAt: "2026-05-03T20:05", volumeMl: 25 },
  { startAt: "2026-05-03T22:52", endAt: "2026-05-03T23:07", volumeMl: 80 },

  // ── 4 мая (10 день)
  {
    ref: "0504-0123",
    startAt: "2026-05-04T01:23",
    endAt: "2026-05-04T01:33",
    volumeMl: 75,
  },
  { parent: "0504-0123", startAt: "2026-05-04T02:50", volumeMl: 30 },
  { startAt: "2026-05-04T04:40", volumeMl: 65 },
  { startAt: "2026-05-04T08:00", endAt: "2026-05-04T08:12", volumeMl: 75 },
  {
    ref: "0504-1125",
    startAt: "2026-05-04T11:25",
    endAt: "2026-05-04T11:37",
    volumeMl: 65,
  },
  { parent: "0504-1125", startAt: "2026-05-04T11:55", volumeMl: 10 },
  { startAt: "2026-05-04T13:50", endAt: "2026-05-04T14:05", volumeMl: 75 },
  { startAt: "2026-05-04T17:30", endAt: "2026-05-04T17:40", volumeMl: 65 },
  { startAt: "2026-05-04T20:45", endAt: "2026-05-04T20:55", volumeMl: 95 },
  { startAt: "2026-05-05T00:00", endAt: "2026-05-05T00:13", volumeMl: 90 },

  // ── 5 мая (11 день)
  { startAt: "2026-05-05T03:17", endAt: "2026-05-05T03:30", volumeMl: 80 },
  {
    ref: "0505-0600",
    startAt: "2026-05-05T06:00",
    endAt: "2026-05-05T06:15",
    volumeMl: 65,
  },
  { parent: "0505-0600", startAt: "2026-05-05T07:20", volumeMl: 20 },
  { startAt: "2026-05-05T09:30", endAt: "2026-05-05T09:55", volumeMl: 85 },
  { startAt: "2026-05-05T14:00", volumeMl: 75 },
  { startAt: "2026-05-05T17:00", endAt: "2026-05-05T17:30", volumeMl: 75 },
  { startAt: "2026-05-05T21:10", endAt: "2026-05-05T21:25", volumeMl: 85 },
  { startAt: "2026-05-05T23:00", volumeMl: 30 },
  { startAt: "2026-05-06T00:30", volumeMl: 75 },

  // ── 6 мая (12 день)
  { startAt: "2026-05-06T03:35", endAt: "2026-05-06T03:49", volumeMl: 85 },
  { startAt: "2026-05-06T06:33", endAt: "2026-05-06T06:47", volumeMl: 80 },
  {
    ref: "0506-1003",
    startAt: "2026-05-06T10:03",
    volumeMl: 68,
  },
  { parent: "0506-1003", startAt: "2026-05-06T12:00", volumeMl: 35 },
  { startAt: "2026-05-06T14:40", volumeMl: 50 },
  { startAt: "2026-05-06T16:45", volumeMl: 70 },
  { startAt: "2026-05-06T19:50", endAt: "2026-05-06T20:07", volumeMl: 93 },
  {
    ref: "0506-2300",
    startAt: "2026-05-06T23:00",
    volumeMl: 90,
  },
  { parent: "0506-2300", startAt: "2026-05-07T00:15", volumeMl: 25 },

  // ── 7 мая (13 день)
  { startAt: "2026-05-07T03:05", endAt: "2026-05-07T03:15", volumeMl: 85 },
  { startAt: "2026-05-07T09:05", endAt: "2026-05-07T09:15", volumeMl: 90 },
  { startAt: "2026-05-07T09:29", endAt: "2026-05-07T09:43", volumeMl: 85 },
  { startAt: "2026-05-07T12:10", endAt: "2026-05-07T12:25", volumeMl: 90 },
  { startAt: "2026-05-07T14:00", volumeMl: 60 },
  { startAt: "2026-05-07T15:00", volumeMl: 30 },
  { startAt: "2026-05-07T18:45", endAt: "2026-05-07T19:00", volumeMl: 90 },
  { startAt: "2026-05-07T22:15", endAt: "2026-05-07T22:30", volumeMl: 75 },
  { startAt: "2026-05-07T23:50", endAt: "2026-05-08T00:00", volumeMl: 43 },

  // ── 8 мая (14 день)
  { startAt: "2026-05-08T03:30", volumeMl: 90 },
  { startAt: "2026-05-08T06:15", endAt: "2026-05-08T06:28", volumeMl: 85 },
  { startAt: "2026-05-08T09:30", volumeMl: 80 },
  { startAt: "2026-05-08T12:30", volumeMl: 90 },
  { startAt: "2026-05-08T16:10", endAt: "2026-05-08T16:20", volumeMl: 90 },
  { startAt: "2026-05-08T17:50", endAt: "2026-05-08T18:05", volumeMl: 55 },
  { startAt: "2026-05-08T20:00", volumeMl: 85 },
  { startAt: "2026-05-08T21:45", volumeMl: 40 },

  // ── 9 мая (15 день)
  { startAt: "2026-05-09T00:20", endAt: "2026-05-09T00:30", volumeMl: 80 },
  {
    ref: "0509-0320",
    startAt: "2026-05-09T03:20",
    endAt: "2026-05-09T03:28",
    volumeMl: 65,
  },
  { parent: "0509-0320", startAt: "2026-05-09T04:00", volumeMl: 30 },
  { startAt: "2026-05-09T05:59", endAt: "2026-05-09T06:08", volumeMl: 65 },
  { startAt: "2026-05-09T08:00", volumeMl: 85 },
];

async function seedHistory(babyId: Types.ObjectId) {
  // Build with deterministic ObjectIds so we can wire up parent references.
  const refToId = new Map<string, Types.ObjectId>();
  const docs = HISTORY.map((f) => {
    const _id = new Types.ObjectId();
    if (f.ref) refToId.set(f.ref, _id);
    return { ...f, _id };
  });

  const created = docs.map((f) => ({
    _id: f._id,
    babyId,
    startAt: k(f.startAt),
    endAt: f.endAt ? k(f.endAt) : null,
    volumeMl: f.volumeMl,
    isTopUp: !!f.parent,
    parentFeedingId: f.parent ? (refToId.get(f.parent) ?? null) : null,
  }));

  // Skip-if-already-seeded: compare counts in the seeded window (1 May .. last
  // history date, inclusive). If anything is there, assume the history is
  // already loaded and do nothing — `--reset` is the way to refresh.
  const last = created.reduce((a, f) =>
    f.startAt.getTime() > a.startAt.getTime() ? f : a,
  );
  const lastPlus1Day = new Date(last.startAt.getTime() + 24 * 3600 * 1000);
  const range = {
    $gte: k("2026-05-01T00:00"),
    $lt: lastPlus1Day,
  };
  const existing = await FeedingModel.countDocuments({ startAt: range });
  if (existing > 0) {
    console.log(
      `seed: history already present (${existing} feedings in window), skipping`,
    );
    return;
  }

  await FeedingModel.insertMany(created);
  console.log(`seed: inserted ${created.length} feedings`);
}

async function main() {
  const reset = process.argv.includes("--reset");
  await dbConnect();

  if (reset) {
    await Promise.all([
      BabyModel.deleteMany({}),
      WeightModel.deleteMany({}),
      FeedingModel.deleteMany({}),
    ]);
    console.log("seed: collections wiped");
  }

  let baby = await BabyModel.findOne({ name: BABY_NAME });
  if (baby) {
    console.log(`seed: baby "${BABY_NAME}" already exists, skipping`);
  } else {
    baby = await BabyModel.create({
      name: BABY_NAME,
      birthDate: BIRTH_DATE,
      birthWeightGrams: BIRTH_WEIGHT_GRAMS,
      feedingsPerDay: FEEDINGS_PER_DAY,
    });
    console.log(`seed: created baby "${BABY_NAME}"`);
  }
  const babyId = baby._id as Types.ObjectId;

  const existingWeight = await WeightModel.findOne({ babyId, date: BIRTH_DATE });
  if (existingWeight) {
    console.log(`seed: initial weight already exists, skipping`);
  } else {
    await WeightModel.create({
      babyId,
      date: BIRTH_DATE,
      weightGrams: BIRTH_WEIGHT_GRAMS,
    });
    console.log(`seed: created initial weight ${BIRTH_WEIGHT_GRAMS}g`);
  }

  await seedHistory(babyId);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
