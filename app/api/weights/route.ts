import { NextResponse, type NextRequest } from "next/server";
import { Types } from "mongoose";
import { ZodError } from "zod";
import { dbConnect } from "@/lib/mongodb";
import { WeightModel } from "@/models/weight";
import { weightSchema } from "@/lib/schemas/weight";
import { badRequest, serverError } from "@/lib/api/respond";
import { serializeWeight } from "@/lib/api/feedings";
import { resolveActiveBaby } from "@/lib/api/activeBaby";

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
    await dbConnect();
    const created = await WeightModel.create({
      ...parsed,
      babyId: new Types.ObjectId(active.baby._id),
    });
    return NextResponse.json(
      serializeWeight(
        created.toObject() as unknown as Parameters<typeof serializeWeight>[0],
      ),
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof ZodError) return badRequest(err);
    return serverError(err);
  }
}
