import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import { FormulaModel } from "@/models/formula";
import { serializeFormula } from "@/lib/api/serializeFormula";
import { serverError } from "@/lib/api/respond";

export const runtime = "nodejs";

export async function GET() {
  try {
    await dbConnect();
    const docs = await FormulaModel.find({ archivedAt: null })
      .sort({ name: 1 })
      .lean();
    return NextResponse.json(
      (docs as unknown as Parameters<typeof serializeFormula>[0][]).map(
        serializeFormula,
      ),
    );
  } catch (err) {
    return serverError(err);
  }
}
