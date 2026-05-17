import { NextResponse } from "next/server";
import { resolveActiveBaby } from "@/lib/api/activeBaby";
import { serializeBabyWithFormula } from "@/lib/api/serializeBabyWithFormula";
import { notFound, serverError } from "@/lib/api/respond";

export const runtime = "nodejs";

export async function GET() {
  try {
    const active = await resolveActiveBaby();
    if (!active) return notFound("baby");
    return NextResponse.json(await serializeBabyWithFormula(active.baby));
  } catch (err) {
    return serverError(err);
  }
}
