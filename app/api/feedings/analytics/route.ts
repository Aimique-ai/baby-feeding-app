import { NextResponse, type NextRequest } from "next/server";
import { Types } from "mongoose";
import { dbConnect } from "@/lib/mongodb";
import { FeedingModel } from "@/models/feeding";
import { WeightModel } from "@/models/weight";
import { dayMetrics } from "@/lib/planning/metrics";
import { computeTarget } from "@/lib/planning/target";
import {
  addDaysISO,
  dayOfLife,
  endOfLocalDay,
  localDateISO,
  startOfLocalDay,
} from "@/lib/planning/dayBoundary";
import type { Feeding } from "@/lib/planning/types";
import { getTzFromRequest } from "@/lib/api/tz";
import { serverError } from "@/lib/api/respond";
import { resolveActiveBaby } from "@/lib/api/activeBaby";

export const runtime = "nodejs";

const WINDOW_DAYS = 30;

export async function GET(req: NextRequest) {
  try {
    const tz = await getTzFromRequest(req);
    const today = localDateISO(new Date(), tz);

    const active = await resolveActiveBaby();
    if (!active) {
      return NextResponse.json({ tz, items: [] });
    }

    const babyId = new Types.ObjectId(active.baby._id);
    const babyBirthDate = new Date(active.baby.birthDate);
    const birthLocal = startOfLocalDay(localDateISO(babyBirthDate, tz), tz);

    // Build chronological day list: from oldest to newest, up to WINDOW_DAYS,
    // but not before birth day.
    const days: string[] = [];
    let d = today;
    for (let i = 0; i < WINDOW_DAYS; i++) {
      const dayStart = startOfLocalDay(d, tz);
      if (dayStart.getTime() < birthLocal.getTime()) break;
      days.push(d);
      d = addDaysISO(d, -1);
    }
    days.reverse();

    if (days.length === 0) {
      return NextResponse.json({ tz, items: [] });
    }

    await dbConnect();
    const weights = await WeightModel.find({ babyId })
      .select("date weightGrams")
      .lean();
    const weightsPlan = (
      weights as unknown as { date: Date; weightGrams: number }[]
    ).map((w) => ({ date: w.date, weightGrams: w.weightGrams }));

    const feedingsByDay = new Map<string, Feeding[]>();
    for (const dateISO of days) feedingsByDay.set(dateISO, []);

    const gte = startOfLocalDay(days[0], tz);
    const lt = endOfLocalDay(days[days.length - 1], tz);
    const docs = (await FeedingModel.find({
      babyId,
      startAt: { $gte: gte, $lt: lt },
    })
      .select("startAt endAt volumeMl isTopUp")
      .sort({ startAt: 1 })
      .lean()) as unknown as {
      startAt: Date;
      endAt: Date | null;
      volumeMl: number | null;
      isTopUp: boolean;
    }[];

    for (const doc of docs) {
      const iso = localDateISO(doc.startAt, tz);
      const bucket = feedingsByDay.get(iso);
      if (!bucket) continue;
      bucket.push({
        _id: "",
        startAt: doc.startAt,
        endAt: doc.endAt,
        volumeMl: doc.volumeMl,
        isTopUp: doc.isTopUp,
        parentFeedingId: null,
      });
    }

    const items = days.map((dateISO) => {
      const dayStart = startOfLocalDay(dateISO, tz);
      const facts = feedingsByDay.get(dateISO) ?? [];
      const target = computeTarget(
        dateISO,
        {
          birthDate: babyBirthDate,
          birthWeightGrams: active.baby.birthWeightGrams,
          feedingsPerDay: active.baby.feedingsPerDay,
        },
        weightsPlan,
        tz,
      );
      const m = dayMetrics(facts, target);
      return {
        dateISO,
        dol: dayOfLife(babyBirthDate, dayStart, tz),
        target,
        fact: m.factOfDay,
      };
    });

    return NextResponse.json({ tz, items });
  } catch (err) {
    return serverError(err);
  }
}
