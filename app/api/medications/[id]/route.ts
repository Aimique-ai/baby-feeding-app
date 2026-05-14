import { NextResponse, type NextRequest } from "next/server";
import { Types } from "mongoose";
import { ZodError } from "zod";
import { dbConnect } from "@/lib/mongodb";
import { MedicationModel } from "@/models/medication";
import { medicationPatchSchema } from "@/lib/schemas/medication";
import { badRequest, notFound, serverError } from "@/lib/api/respond";
import { serializeMedication } from "@/lib/api/medications";
import { resolveActiveBaby } from "@/lib/api/activeBaby";

export const runtime = "nodejs";

function badId(id: string) {
  return !Types.ObjectId.isValid(id);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (badId(id)) return notFound("medication");
    const active = await resolveActiveBaby();
    if (!active) return notFound("medication");
    await dbConnect();
    const doc = await MedicationModel.findById(id).lean();
    if (
      !doc ||
      !(doc as unknown as { babyId: Types.ObjectId }).babyId.equals(
        new Types.ObjectId(active.baby._id),
      )
    )
      return notFound("medication");
    return NextResponse.json(
      serializeMedication(
        doc as unknown as Parameters<typeof serializeMedication>[0],
      ),
    );
  } catch (err) {
    return serverError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (badId(id)) return notFound("medication");
    const active = await resolveActiveBaby();
    if (!active) return notFound("medication");
    const body = await req.json();
    const parsed = medicationPatchSchema.parse(body);
    await dbConnect();
    const doc = await MedicationModel.findById(id).lean();
    if (
      !doc ||
      !(doc as unknown as { babyId: Types.ObjectId }).babyId.equals(
        new Types.ObjectId(active.baby._id),
      )
    )
      return notFound("medication");
    if (parsed.name !== undefined) {
      const collision = await MedicationModel.findOne({
        babyId: new Types.ObjectId(active.baby._id),
        deletedAt: null,
        name: parsed.name,
        _id: { $ne: new Types.ObjectId(id) },
      })
        .collation({ locale: "en", strength: 2 })
        .lean();
      if (collision) {
        return NextResponse.json(
          { ok: false, error: "duplicate_name" },
          { status: 409 },
        );
      }
    }
    const updated = await MedicationModel.findByIdAndUpdate(id, parsed, {
      new: true,
    }).lean();
    if (!updated) return notFound("medication");
    return NextResponse.json(
      serializeMedication(
        updated as unknown as Parameters<typeof serializeMedication>[0],
      ),
    );
  } catch (err) {
    if (err instanceof ZodError) return badRequest(err);
    return serverError(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (badId(id)) return notFound("medication");
    const active = await resolveActiveBaby();
    if (!active) return notFound("medication");
    await dbConnect();
    const doc = await MedicationModel.findById(id).lean();
    if (
      !doc ||
      !(doc as unknown as { babyId: Types.ObjectId }).babyId.equals(
        new Types.ObjectId(active.baby._id),
      )
    )
      return notFound("medication");
    const updated = await MedicationModel.findByIdAndUpdate(
      id,
      { deletedAt: new Date() },
      { new: true },
    );
    if (!updated) return notFound("medication");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err);
  }
}
