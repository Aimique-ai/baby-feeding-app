import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";

export async function GET() {
  try {
    const conn = await dbConnect();
    return NextResponse.json({
      ok: true,
      readyState: conn.connection.readyState,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
