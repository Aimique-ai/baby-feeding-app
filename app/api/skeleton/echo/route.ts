import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import { fetchSkeletonFeedings } from "@/app/skeleton/data";
import type { SkeletonFeeding } from "@/app/skeleton/types";

export const runtime = "nodejs";

export async function GET() {
  const data = await fetchSkeletonFeedings();
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  await dbConnect();
  const body = (await req.json().catch(() => ({}))) as { volumeMl?: number };
  const echoed: SkeletonFeeding = {
    id: `echo-${Date.now()}`,
    startAt: new Date().toISOString(),
    volumeMl: body.volumeMl ?? 0,
  };
  return NextResponse.json(echoed);
}
