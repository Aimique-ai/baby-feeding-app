import type { ErrorHandler } from "hono";
import { ZodError } from "zod";
import type { AppEnv } from "../types.js";

export const onError: ErrorHandler<AppEnv> = (err, c) => {
  if (err instanceof ZodError) {
    return c.json(
      {
        ok: false,
        error: "validation_failed",
        issues: err.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      400,
    );
  }
  if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: number }).code === 11000
  ) {
    return c.json({ ok: false, error: "duplicate_key" }, 409);
  }
  console.error("[api] unhandled error:", err);
  return c.json(
    { ok: false, error: (err as Error).message ?? "server_error" },
    500,
  );
};
