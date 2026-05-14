import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function GET() {
  try {
    await dbConnect();
    const admin = mongoose.connection.db?.admin();
    const ping = admin ? await admin.ping() : { ok: 0 };
    return NextResponse.json({ ok: true, ping });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
