import { fromZonedTime } from "date-fns-tz";

/**
 * Convert a calendar day in a given IANA timezone to UTC range bounds.
 *
 * The day is the half-open interval [00:00 local, 24:00 local).
 *
 * @param dateISO YYYY-MM-DD (calendar day in `tz`)
 * @param tz IANA timezone identifier, e.g. "Europe/Kyiv"
 * @returns { gte, lt } UTC `Date` bounds suitable for Mongoose `$gte`/`$lt` queries
 */
export function dayRangeUtc(
  dateISO: string,
  tz: string,
): { gte: Date; lt: Date } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
    throw new Error(`dayRangeUtc: invalid dateISO "${dateISO}"`);
  }
  const [y, m, d] = dateISO.split("-").map(Number);
  const startLocal = `${dateISO}T00:00:00`;
  const gte = fromZonedTime(startLocal, tz);

  // Next-day local midnight handles DST transitions correctly: a "day" can be
  // 23h or 25h in wall-clock terms; fromZonedTime maps each side cleanly.
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const nextISO = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
  const lt = fromZonedTime(`${nextISO}T00:00:00`, tz);

  return { gte, lt };
}
