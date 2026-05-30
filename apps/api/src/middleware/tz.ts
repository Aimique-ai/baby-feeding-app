import type { MiddlewareHandler } from "hono";
import { TZ_HEADER } from "@leon/schemas/headers";
import type { AppEnv } from "../types.js";

const DEFAULT_TZ = "UTC";

function isValidTimeZone(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const tz: MiddlewareHandler<AppEnv> = async (c, next) => {
  const headerValue = c.req.header(TZ_HEADER);
  c.set("tz", isValidTimeZone(headerValue) ? headerValue : DEFAULT_TZ);
  await next();
};
