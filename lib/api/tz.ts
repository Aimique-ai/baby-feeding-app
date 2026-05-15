import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

export const DEFAULT_TZ = "Europe/Kyiv";
export const TZ_HEADER = "x-time-zone";

export function isValidTimeZone(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * Read the user's IANA timezone from the `tz` cookie. Falls back to
 * Europe/Kyiv on first paint (cookie is written by a small client effect).
 */
export async function getTzFromCookie(): Promise<string> {
  const c = await cookies();
  const v = c.get("tz")?.value;
  return isValidTimeZone(v) ? v : DEFAULT_TZ;
}

/**
 * For client-originated API requests, trust a valid browser timezone header
 * before the SSR sync cookie. This closes the first-visit gap before the cookie
 * has caused a refreshed server render.
 */
export async function getTzFromRequest(req: NextRequest): Promise<string> {
  const headerTz = req.headers.get(TZ_HEADER);
  if (isValidTimeZone(headerTz)) return headerTz;
  return getTzFromCookie();
}
