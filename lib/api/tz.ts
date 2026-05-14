import { cookies } from "next/headers";

export const DEFAULT_TZ = "Europe/Kyiv";

/**
 * Read the user's IANA timezone from the `tz` cookie. Falls back to
 * Europe/Kyiv on first paint (cookie is written by a small client effect).
 */
export async function getTzFromCookie(): Promise<string> {
  const c = await cookies();
  const v = c.get("tz")?.value;
  return v && v.length > 0 ? v : DEFAULT_TZ;
}
