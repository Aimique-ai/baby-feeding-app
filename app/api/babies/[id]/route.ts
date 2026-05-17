import { NextResponse, type NextRequest } from "next/server";
import { Types } from "mongoose";
import { ZodError } from "zod";
import { cookies } from "next/headers";
import { dbConnect } from "@/lib/mongodb";
import { BabyModel } from "@/models/baby";
import { babyPatchSchema } from "@/lib/schemas/baby";
import { badRequest, notFound, serverError } from "@/lib/api/respond";
import { serializeBaby } from "@/lib/api/activeBaby";
import { formulaExists } from "@/lib/api/assertFormulaExists";

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
    if (badId(id)) return notFound("baby");
    const body = await req.json();
    const parsed = babyPatchSchema.parse(body);
    await dbConnect();
    if (
      "currentFormulaId" in parsed &&
      !(await formulaExists(parsed.currentFormulaId))
    ) {
      return notFound("formula");
    }
    const updated = await BabyModel.findByIdAndUpdate(id, parsed, {
      new: true,
    }).lean();
    if (!updated) return notFound("baby");
    return NextResponse.json(
      serializeBaby(
        updated as unknown as Parameters<typeof serializeBaby>[0],
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
    if (badId(id)) return notFound("baby");
    await dbConnect();
    const updated = await BabyModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), archivedAt: null },
      { archivedAt: new Date() },
      { new: true },
    );
    if (!updated) return notFound("baby");

    const jar = await cookies();
    const activeCookieId = jar.get("activeBabyId")?.value;
    if (activeCookieId === id) {
      jar.set("activeBabyId", "", { maxAge: 0, path: "/" });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err);
  }
}
