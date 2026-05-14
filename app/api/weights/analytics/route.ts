import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { dbConnect } from "@/lib/mongodb";
import { WeightModel } from "@/models/weight";
import { serializeWeight } from "@/lib/api/feedings";
import { resolveActiveBaby } from "@/lib/api/activeBaby";
import { getTzFromCookie } from "@/lib/api/tz";
import { buildAnalytics } from "@/lib/who/analytics";
import { serverError } from "@/lib/api/respond";

export const runtime = "nodejs";

export async function GET() {
  try {
    const active = await resolveActiveBaby();
    if (!active)
      return NextResponse.json(
        { ok: false, error: "no_active_baby" },
        { status: 400 },
      );
    const tz = await getTzFromCookie();
    await dbConnect();
    const docs = await WeightModel.find({
      babyId: new Types.ObjectId(active.baby._id),
    })
      .sort({ date: 1 })
      .lean();
    const weights = (
      docs as unknown as Parameters<typeof serializeWeight>[0][]
    ).map(serializeWeight);
    const analytics = buildAnalytics(active.baby, weights, tz);
    return NextResponse.json(analytics);
  } catch (err) {
    return serverError(err);
  }
}
