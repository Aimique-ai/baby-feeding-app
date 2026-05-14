import { NextResponse, type NextRequest } from "next/server";
import { Types } from "mongoose";
import { ZodError } from "zod";
import { dbConnect } from "@/lib/mongodb";
import { MedicationModel } from "@/models/medication";
import { medicationSchema } from "@/lib/schemas/medication";
import { badRequest, serverError } from "@/lib/api/respond";
import { serializeMedication } from "@/lib/api/medications";
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
    const docs = await MedicationModel.find({
      babyId: new Types.ObjectId(active.baby._id),
      deletedAt: null,
    })
      .sort({ createdAt: 1 })
      .lean();
    const list = (
      docs as unknown as Parameters<typeof serializeMedication>[0][]
    ).map(serializeMedication);
    return NextResponse.json(list);
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
    const parsed = medicationSchema.parse(body);
    await dbConnect();
    const existing = await MedicationModel.findOne({
      babyId: new Types.ObjectId(active.baby._id),
      deletedAt: null,
      name: parsed.name,
    })
      .collation({ locale: "en", strength: 2 })
      .lean();
    if (existing) {
      return NextResponse.json(
        { ok: false, error: "duplicate_name" },
        { status: 409 },
      );
    }
    const created = await MedicationModel.create({
      ...parsed,
      babyId: new Types.ObjectId(active.baby._id),
    });
    return NextResponse.json(
      serializeMedication(
        created.toObject() as unknown as Parameters<
          typeof serializeMedication
        >[0],
      ),
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof ZodError) return badRequest(err);
    return serverError(err);
  }
}
