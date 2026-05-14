import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export function badRequest(error: ZodError) {
  return NextResponse.json(
    {
      ok: false,
      error: "validation_failed",
      issues: error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    },
    { status: 400 },
  );
}

export function notFound(resource = "resource") {
  return NextResponse.json(
    { ok: false, error: `${resource}_not_found` },
    { status: 404 },
  );
}

export function serverError(err: unknown) {
  return NextResponse.json(
    { ok: false, error: (err as Error).message ?? "server_error" },
    { status: 500 },
  );
}
