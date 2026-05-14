import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { Types } from "mongoose";
import { dbConnect } from "@/lib/mongodb";
import { FeedingModel } from "@/models/feeding";
import { MedicationModel } from "@/models/medication";
import { feedingSchema } from "@/lib/schemas/feeding";
import { dayRangeUtc } from "@/lib/time/dayRange";
import { getTzFromCookie } from "@/lib/api/tz";
import { badRequest, serverError } from "@/lib/api/respond";
import { serializeFeeding } from "@/lib/api/feedings";
import { resolveActiveBaby } from "@/lib/api/activeBaby";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const dateISO = req.nextUrl.searchParams.get("date");
    if (!dateISO || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
      return NextResponse.json(
        { ok: false, error: "missing_or_invalid_date" },
        { status: 400 },
      );
    }
    const active = await resolveActiveBaby();
    if (!active)
      return NextResponse.json(
        { ok: false, error: "no_active_baby" },
        { status: 400 },
      );

    const tz = await getTzFromCookie();
    const { gte, lt } = dayRangeUtc(dateISO, tz);

    await dbConnect();
    const docs = await FeedingModel.find({
      babyId: new Types.ObjectId(active.baby._id),
      startAt: { $gte: gte, $lt: lt },
    })
      .sort({ startAt: 1 })
      .lean();
    const feedings = (
      docs as unknown as Parameters<typeof serializeFeeding>[0][]
    ).map(serializeFeeding);

    return NextResponse.json(feedings);
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const active = await resolveActiveBaby();
    if (!active)
      return NextResponse.json(
        { ok: false, error: "no_active_baby" },
        { status: 400 },
      );

    const body = await req.json();
    const parsed = feedingSchema.parse(body);
    await dbConnect();

    // PRD §4 (locked, single-shift algo): never author isTopUp/parentFeedingId
    // on writes — historical rows may have them but new records are always main.
    const data = {
      ...parsed,
      isTopUp: false,
      parentFeedingId: null,
      babyId: new Types.ObjectId(active.baby._id),
    };

    if (data.medicationId) {
      const med = await MedicationModel.findById(data.medicationId).lean();
      if (
        !med ||
        !(med as unknown as { babyId: Types.ObjectId }).babyId.equals(
          new Types.ObjectId(active.baby._id),
        )
      ) {
        return NextResponse.json(
          { ok: false, error: "cross_baby_reference" },
          { status: 400 },
        );
      }
    }

    const created = await FeedingModel.create(data);
    return NextResponse.json(
      serializeFeeding(
        created.toObject() as unknown as Parameters<
          typeof serializeFeeding
        >[0],
      ),
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof ZodError) return badRequest(err);
    return serverError(err);
  }
}
