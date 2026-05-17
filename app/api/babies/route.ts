import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { dbConnect } from "@/lib/mongodb";
import { BabyModel } from "@/models/baby";
import { babySchema } from "@/lib/schemas/baby";
import { badRequest, notFound, serverError } from "@/lib/api/respond";
import { serializeBaby } from "@/lib/api/activeBaby";
import { formulaExists } from "@/lib/api/assertFormulaExists";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const includeArchived =
      req.nextUrl.searchParams.get("includeArchived") === "true";
    await dbConnect();
    const filter = includeArchived
      ? { archivedAt: { $ne: null } }
      : { archivedAt: null };
    const docs = await BabyModel.find(filter).sort({ createdAt: 1 }).lean();
    return NextResponse.json(
      (docs as unknown as Parameters<typeof serializeBaby>[0][]).map(
        serializeBaby,
      ),
    );
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = babySchema.parse(body);
    await dbConnect();
    if (!(await formulaExists(parsed.currentFormulaId))) {
      return notFound("formula");
    }
    const created = await BabyModel.create(parsed);
    return NextResponse.json(
      serializeBaby(
        created.toObject() as unknown as Parameters<typeof serializeBaby>[0],
      ),
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof ZodError) return badRequest(err);
    // Mongoose duplicate key error
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: number }).code === 11000
    ) {
      return NextResponse.json(
        { ok: false, error: "duplicate_name" },
        { status: 409 },
      );
    }
    return serverError(err);
  }
}
