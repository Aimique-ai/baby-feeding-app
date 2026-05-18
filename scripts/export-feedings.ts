/**
 * Export all feedings from DB as a Markdown report grouped by day (Europe/Kyiv).
 *
 * Usage: pnpm tsx scripts/export-feedings.ts > docs/feedings.md
 */
import mongoose, { Types } from "mongoose";
import { formatInTimeZone } from "date-fns-tz";
import { dbConnect } from "../lib/mongodb";
import { BabyModel } from "../models/baby";
import { FeedingModel } from "../models/feeding";

const TZ = "Europe/Kyiv";
const MONTHS = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

type FeedingDoc = {
  _id: Types.ObjectId;
  startAt: Date;
  endAt: Date | null;
  volumeMl: number | null;
  isTopUp: boolean;
};

function fmtTime(d: Date): string {
  return formatInTimeZone(d, TZ, "HH:mm");
}

function dayKey(d: Date): string {
  return formatInTimeZone(d, TZ, "yyyy-MM-dd");
}

function dayLabel(key: string, dayNumberFromBirth: number | null): string {
  const [, m, d] = key.split("-").map(Number);
  const month = MONTHS[m - 1];
  const suffix =
    dayNumberFromBirth != null ? ` (${dayNumberFromBirth} день)` : "";
  return `${d} ${month}${suffix}`;
}

function durationMin(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 60000);
}

async function main() {
  await dbConnect();

  const baby = await BabyModel.findOne({});
  const birthMs = baby?.birthDate ? new Date(baby.birthDate).getTime() : null;

  const all = (await FeedingModel.find({})
    .sort({ startAt: 1 })
    .lean()) as unknown as FeedingDoc[];

  // Group by Kyiv day
  const byDay = new Map<string, FeedingDoc[]>();
  for (const f of all) {
    const k = dayKey(f.startAt);
    const arr = byDay.get(k) ?? [];
    arr.push(f);
    byDay.set(k, arr);
  }

  const out: string[] = [];
  const days = Array.from(byDay.keys()).sort();

  for (const dKey of days) {
    const feedings = byDay.get(dKey) ?? [];
    feedings.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

    // Day number from birth (day 1 = birthDate)
    let dayNum: number | null = null;
    if (birthMs != null) {
      const [y, m, d] = dKey.split("-").map(Number);
      const localNoonUtc = Date.UTC(y, m - 1, d, 12, 0, 0);
      const birthDayKey = formatInTimeZone(
        new Date(birthMs),
        TZ,
        "yyyy-MM-dd",
      );
      const [by, bm, bd] = birthDayKey.split("-").map(Number);
      const birthNoonUtc = Date.UTC(by, bm - 1, bd, 12, 0, 0);
      dayNum =
        Math.round((localNoonUtc - birthNoonUtc) / (24 * 3600 * 1000)) + 1;
    }

    out.push(`## ${dayLabel(dKey, dayNum)}`);
    out.push("");

    let totalMl = 0;
    let durSum = 0;
    let durCount = 0;

    feedings.forEach((f, i) => {
      const start = fmtTime(f.startAt);
      const end = f.endAt ? fmtTime(f.endAt) : null;
      const dur = f.endAt ? durationMin(f.startAt, f.endAt) : null;
      const timeStr = end ? `**${start}–${end}** (${dur} мин)` : `${start}`;
      const marker = f.isTopUp ? " · докорм" : "";
      const line = `${i + 1}. ${timeStr} — **${f.volumeMl ?? "?"} мл**${marker}`;
      if (f.volumeMl != null) totalMl += f.volumeMl;
      if (dur != null) {
        durSum += dur;
        durCount += 1;
      }
      out.push(line);
    });

    out.push("");
    out.push(`Итого: **${totalMl} мл**`);
    if (durCount > 0) {
      const avg = durSum / durCount;
      const min = Math.floor(avg);
      const sec = Math.round((avg - min) * 60);
      out.push(
        `Средняя длительность (где есть старт/финиш): **${min} мин ${sec
          .toString()
          .padStart(2, "0")} сек** (${durCount} ${
          durCount === 1
            ? "кормление"
            : durCount < 5
              ? "кормления"
              : "кормлений"
        })`,
      );
    }
    out.push("");
    out.push("---");
    out.push("");
  }

  process.stdout.write(out.join("\n"));
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
