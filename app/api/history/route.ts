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
import { resolveFormulaDensity } from "@/lib/api/resolveFormulaDensity";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 90;

function shiftIso(iso: string, days: number): string {
  return addDaysISO(iso, days);
}

export async function GET(req: NextRequest) {
  try {
    const tz = await getTzFromRequest(req);
    const cursor =
      req.nextUrl.searchParams.get("cursor") ??
      localDateISO(new Date(), tz);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(
        1,
        Number(req.nextUrl.searchParams.get("limit") ?? DEFAULT_LIMIT),
      ),
    );

    if (!/^\d{4}-\d{2}-\d{2}$/.test(cursor)) {
      return NextResponse.json(
        { ok: false, error: "invalid_cursor" },
        { status: 400 },
      );
    }

    const active = await resolveActiveBaby();
    if (!active) {
      return NextResponse.json({ items: [], nextCursor: null });
    }

    const babyId = new Types.ObjectId(active.baby._id);
    const babyBirthDate = new Date(active.baby.birthDate);

    await dbConnect();
    const formulaDensity = await resolveFormulaDensity(
      active.baby.currentFormulaId,
    );
    const weights = await WeightModel.find({ babyId })
      .select("date weightGrams")
      .lean();
    const weightsPlan = (
      weights as unknown as { date: Date; weightGrams: number }[]
    ).map((w) => ({ date: w.date, weightGrams: w.weightGrams }));

    // Build the requested window of `limit` days going back from cursor.
    const days: string[] = [];
    let d = cursor;
    const birthLocal = startOfLocalDay(localDateISO(babyBirthDate, tz), tz);
    for (let i = 0; i < limit; i++) {
      const dayStart = startOfLocalDay(d, tz);
      if (dayStart.getTime() < birthLocal.getTime()) break;
      days.push(d);
      d = shiftIso(d, -1);
    }

    // One Mongo query for the whole window; group feedings by local date.
    const feedingsByDay = new Map<string, Feeding[]>();
    for (const dateISO of days) feedingsByDay.set(dateISO, []);

    if (days.length > 0) {
      const earliest = days[days.length - 1];
      const latest = days[0];
      const gte = startOfLocalDay(earliest, tz);
      const lt = endOfLocalDay(latest, tz);
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
        });
      }
    }

    const items: {
      dateISO: string;
      dol: number;
      target: number;
      factOfDay: number;
      feedingsCount: number;
      topUpsCount: number;
      avgDurationMs: number | null;
      deficit: number;
    }[] = [];

    for (const dateISO of days) {
      const dayStart = startOfLocalDay(dateISO, tz);
      const facts = feedingsByDay.get(dateISO) ?? [];
      const target = computeTarget(
        dateISO,
        {
          birthDate: babyBirthDate,
          birthWeightGrams: active.baby.birthWeightGrams,
        },
        weightsPlan,
        tz,
        formulaDensity,
      );
      const m = dayMetrics(facts, target);
      items.push({
        dateISO,
        dol: dayOfLife(babyBirthDate, dayStart, tz),
        target,
        ...m,
      });
    }

    const nextCursor = days.length === limit ? d : null;
    return NextResponse.json({ items, nextCursor });
  } catch (err) {
    return serverError(err);
  }
}
