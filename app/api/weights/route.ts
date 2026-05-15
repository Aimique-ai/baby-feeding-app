import { NextResponse, type NextRequest } from "next/server";
import { Types } from "mongoose";
import { ZodError } from "zod";
import { fromZonedTime } from "date-fns-tz";
import { dbConnect } from "@/lib/mongodb";
import { WeightModel } from "@/models/weight";
import { weightSchema } from "@/lib/schemas/weight";
import { badRequest, serverError } from "@/lib/api/respond";
import { serializeWeight } from "@/lib/api/feedings";
import { resolveActiveBaby } from "@/lib/api/activeBaby";
import { getTzFromRequest } from "@/lib/api/tz";

export const runtime = "nodejs";

export async function GET() {
  try {
    const active = await resolveActiveBaby();
    if (!active)
      return NextResponse.json(
        { ok: false, error: "no_active_baby" },
        { status: 400 },
      );
    await dbConnect();
    const list = await WeightModel.find({
      babyId: new Types.ObjectId(active.baby._id),
    })
      .sort({ date: -1 })
      .lean();
    return NextResponse.json(
      (list as unknown as Parameters<typeof serializeWeight>[0][]).map(
        serializeWeight,
      ),
    );
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
    const parsed = weightSchema.parse(body);
    const tz = await getTzFromRequest(req);
    const date = fromZonedTime(`${parsed.dateISO}T00:00:00`, tz);
    await dbConnect();
    const updated = await WeightModel.findOneAndUpdate(
      {
        babyId: new Types.ObjectId(active.baby._id),
        date,
      },
      {
        $set: { weightGrams: parsed.weightGrams },
        $setOnInsert: {
          babyId: new Types.ObjectId(active.baby._id),
          date,
        },
      },
      { new: true, upsert: true },
    ).lean();
    if (!updated) throw new Error("weight_upsert_failed");
    return NextResponse.json(
      serializeWeight(
        updated as unknown as Parameters<typeof serializeWeight>[0],
      ),
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof ZodError) return badRequest(err);
    return serverError(err);
  }
}
