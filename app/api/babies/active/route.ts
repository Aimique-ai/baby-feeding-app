import { NextResponse, type NextRequest } from "next/server";
import { Types } from "mongoose";
import { cookies } from "next/headers";
import { dbConnect } from "@/lib/mongodb";
import { BabyModel } from "@/models/baby";
import { notFound, serverError } from "@/lib/api/respond";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { babyId } = body as { babyId?: string };
    if (!babyId || !Types.ObjectId.isValid(babyId)) return notFound("baby");
    await dbConnect();
    const baby = await BabyModel.findOne({
      _id: new Types.ObjectId(babyId),
      archivedAt: null,
    }).lean();
    if (!baby) return notFound("baby");
    const jar = await cookies();
    jar.set("activeBabyId", babyId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err);
  }
}
