import { NextResponse, type NextRequest } from "next/server";
import { Types } from "mongoose";
import { dbConnect } from "@/lib/mongodb";
import { FeedingModel } from "@/models/feeding";
import { WeightModel } from "@/models/weight";
import { dayRangeUtc } from "@/lib/time/dayRange";
import { dayMetrics } from "@/lib/planning/metrics";
import { computeTarget } from "@/lib/planning/target";
import { dayOfLife, startOfLocalDay } from "@/lib/planning/dayBoundary";
import { getTzFromCookie } from "@/lib/api/tz";
import { serverError } from "@/lib/api/respond";
import { deserializeFeeding } from "@/lib/api/serializedTypes";
import { serializeFeeding } from "@/lib/api/feedings";
import { resolveActiveBaby } from "@/lib/api/activeBaby";
import { addDays, format } from "date-fns";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 90;

function shiftIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return format(addDays(dt, days), "yyyy-MM-dd");
}

export async function GET(req: NextRequest) {
  try {
    const tz = await getTzFromCookie();
    const cursor =
      req.nextUrl.searchParams.get("cursor") ??
      format(new Date(), "yyyy-MM-dd");
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
    const weights = await WeightModel.find({ babyId }).lean();
    const weightsPlan = (
      weights as unknown as { date: Date; weightGrams: number }[]
    ).map((w) => ({ date: w.date, weightGrams: w.weightGrams }));

    // Build the requested window of `limit` days going back from cursor.
    const days: string[] = [];
    let d = cursor;
    const birthLocal = startOfLocalDay(
      format(babyBirthDate, "yyyy-MM-dd"),
      tz,
    );
    for (let i = 0; i < limit; i++) {
      const dayStart = startOfLocalDay(d, tz);
      if (dayStart.getTime() < birthLocal.getTime()) break;
      days.push(d);
      d = shiftIso(d, -1);
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
      const { gte, lt } = dayRangeUtc(dateISO, tz);
      const docs = await FeedingModel.find({
        babyId,
        startAt: { $gte: gte, $lt: lt },
      })
        .sort({ startAt: 1 })
        .lean();
      const facts = (
        docs as unknown as Parameters<typeof serializeFeeding>[0][]
      )
        .map(serializeFeeding)
        .map(deserializeFeeding);
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
