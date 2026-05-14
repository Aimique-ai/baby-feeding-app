import { NextResponse, type NextRequest } from "next/server";
import { Types } from "mongoose";
import { dbConnect } from "@/lib/mongodb";
import { BabyModel } from "@/models/baby";
import { notFound, serverError } from "@/lib/api/respond";
import { serializeBaby } from "@/lib/api/activeBaby";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) return notFound("baby");
    await dbConnect();
    const updated = await BabyModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), archivedAt: { $ne: null } },
      { archivedAt: null },
      { new: true },
    ).lean();
    if (!updated) return notFound("baby");
    return NextResponse.json(
      serializeBaby(
        updated as unknown as Parameters<typeof serializeBaby>[0],
      ),
    );
  } catch (err) {
    return serverError(err);
  }
}
