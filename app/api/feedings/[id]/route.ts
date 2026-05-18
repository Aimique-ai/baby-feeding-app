import { NextResponse, type NextRequest } from "next/server";
import { Types } from "mongoose";
import { ZodError } from "zod";
import { dbConnect } from "@/lib/mongodb";
import { FeedingModel } from "@/models/feeding";
import { MedicationModel } from "@/models/medication";
import { feedingPatchSchema } from "@/lib/schemas/feeding";
import { badRequest, notFound, serverError } from "@/lib/api/respond";
import { serializeFeeding } from "@/lib/api/feedings";
import { resolveActiveBaby } from "@/lib/api/activeBaby";

export const runtime = "nodejs";

function badId(id: string) {
  return !Types.ObjectId.isValid(id);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (badId(id)) return notFound("feeding");
    const active = await resolveActiveBaby();
    if (!active) return notFound("feeding");
    const body = await req.json();
    // isTopUp редактируется свободно (feed-plan-rewrite §3) — флаг докорма
    // больше не иммутабелен на существующих записях.
    const parsed = feedingPatchSchema.parse(body);
    await dbConnect();
    const doc = await FeedingModel.findById(id).lean();
    if (
      !doc ||
      !(doc as unknown as { babyId: Types.ObjectId }).babyId.equals(
        new Types.ObjectId(active.baby._id),
      )
    )
      return notFound("feeding");

    if (parsed.medicationId) {
      const med = await MedicationModel.findById(parsed.medicationId).lean();
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

    const updated = await FeedingModel.findByIdAndUpdate(id, parsed, {
      new: true,
    }).lean();
    if (!updated) return notFound("feeding");
    return NextResponse.json(
      serializeFeeding(
        updated as unknown as Parameters<typeof serializeFeeding>[0],
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
    if (badId(id)) return notFound("feeding");
    const active = await resolveActiveBaby();
    if (!active) return notFound("feeding");
    await dbConnect();
    const doc = await FeedingModel.findById(id).lean();
    if (
      !doc ||
      !(doc as unknown as { babyId: Types.ObjectId }).babyId.equals(
        new Types.ObjectId(active.baby._id),
      )
    )
      return notFound("feeding");
    await FeedingModel.findByIdAndDelete(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err);
  }
}
