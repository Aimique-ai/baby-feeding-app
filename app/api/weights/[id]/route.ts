import { NextResponse, type NextRequest } from "next/server";
import { Types } from "mongoose";
import { ZodError } from "zod";
import { fromZonedTime } from "date-fns-tz";
import { dbConnect } from "@/lib/mongodb";
import { WeightModel } from "@/models/weight";
import { weightPatchSchema } from "@/lib/schemas/weight";
import { badRequest, notFound, serverError } from "@/lib/api/respond";
import { serializeWeight } from "@/lib/api/feedings";
import { resolveActiveBaby } from "@/lib/api/activeBaby";
import { getTzFromRequest } from "@/lib/api/tz";

export const runtime = "nodejs";

function badId(id: string) {
  return !Types.ObjectId.isValid(id);
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: number }).code === 11000
  );
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (badId(id)) return notFound("weight");
    const active = await resolveActiveBaby();
    if (!active) return notFound("weight");
    const body = await req.json();
    const parsed = weightPatchSchema.parse(body);
    await dbConnect();
    const doc = await WeightModel.findById(id).lean();
    if (
      !doc ||
      !(doc as unknown as { babyId: Types.ObjectId }).babyId.equals(
        new Types.ObjectId(active.baby._id),
      )
    )
      return notFound("weight");

    const set: { weightGrams?: number; date?: Date } = {};
    if (parsed.weightGrams !== undefined) set.weightGrams = parsed.weightGrams;
    if (parsed.dateISO !== undefined) {
      const tz = await getTzFromRequest(req);
      set.date = fromZonedTime(`${parsed.dateISO}T00:00:00`, tz);
    }

    const updated = await WeightModel.findByIdAndUpdate(
      id,
      { $set: set },
      { new: true },
    ).lean();
    if (!updated) return notFound("weight");
    return NextResponse.json(
      serializeWeight(
        updated as unknown as Parameters<typeof serializeWeight>[0],
      ),
    );
  } catch (err) {
    if (err instanceof ZodError) return badRequest(err);
    // Смена даты на уже занятый день нарушает unique-индекс { babyId, date }.
    if (isDuplicateKeyError(err))
      return NextResponse.json(
        { ok: false, error: "duplicate_date" },
        { status: 409 },
      );
    return serverError(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (badId(id)) return notFound("weight");
    const active = await resolveActiveBaby();
    if (!active) return notFound("weight");
    await dbConnect();
    const doc = await WeightModel.findById(id).lean();
    if (
      !doc ||
      !(doc as unknown as { babyId: Types.ObjectId }).babyId.equals(
        new Types.ObjectId(active.baby._id),
      )
    )
      return notFound("weight");
    await WeightModel.findByIdAndDelete(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err);
  }
}
