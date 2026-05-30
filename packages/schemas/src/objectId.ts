import { z } from "zod";

/**
 * 24-hex Mongo ObjectId string. Shared so the regex is declared once and the
 * feeding/weight/medication/baby schemas cannot drift.
 *
 * - `objectIdString` — generic id validator (used in CREATE bodies and as the
 *   shape of response `_id` / nullable foreign-key id fields).
 * - `OBJECT_ID_REGEX` — exported in case a route handler needs the raw pattern
 *   (e.g. cursor / param validation) without pulling in a Zod schema.
 */
export const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;

export const objectIdString = z
  .string()
  .regex(OBJECT_ID_REGEX, "invalid ObjectId");
