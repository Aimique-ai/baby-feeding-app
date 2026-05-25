import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { dbConnect } from "@/lib/mongodb";
import { FeedingModel } from "@/models/feeding";
import { resolveActiveBaby } from "@/lib/api/activeBaby";
import { serverError } from "@/lib/api/respond";
import {
  computeDurationChips,
  DEFAULT_DURATION_CHIPS,
} from "@/lib/feeding/durationChips";
import { FEEDING_DURATION_MAX_MIN } from "@/lib/schemas/constants";

export const runtime = "nodejs";

const WINDOW_DAYS = 14;

export async function GET() {
  try {
    const active = await resolveActiveBaby();
    if (!active) {
      return NextResponse.json(
        { chips: [...DEFAULT_DURATION_CHIPS] },
        { headers: { "Cache-Control": "private, max-age=0, no-cache" } },
      );
    }
    const gte = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
    await dbConnect();
    const docs = (await FeedingModel.find({
      babyId: new Types.ObjectId(active.baby._id),
      startAt: { $gte: gte },
      endAt: { $ne: null },
    })
      .select("startAt endAt")
      .lean()) as { startAt: Date; endAt: Date }[];
    const durations = docs
      .map((d) => Math.round((d.endAt.getTime() - d.startAt.getTime()) / 60000))
      .filter((v) => v >= 1 && v <= FEEDING_DURATION_MAX_MIN);
    return NextResponse.json(
      { chips: computeDurationChips(durations) },
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  } catch (err) {
    return serverError(err);
  }
}
