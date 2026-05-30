import type { MiddlewareHandler } from "hono";
import { Types } from "mongoose";
import { ACTIVE_BABY_HEADER } from "@leon/schemas/headers";
import { dbConnect } from "../db/mongo.js";
import { BabyModel } from "../models/baby.js";
import { serializeBaby } from "../lib/serializeBaby.js";
import type { AppEnv } from "../types.js";

const HEX_24 = /^[a-fA-F0-9]{24}$/;

/**
 * Server-side fallback with echoed response header.
 *  - If x-active-baby-id is present: validate, look up by _id;
 *    if archived OR not found -> 410 with { error: "baby_archived", id }.
 *  - If header missing: fall back to first non-archived by createdAt.
 *    If none -> 412 { error: "no_active_baby" }.
 *  - On success: c.set("baby", doc); echo X-Active-Baby-Id in response.
 */
export const activeBaby: MiddlewareHandler<AppEnv> = async (c, next) => {
  await dbConnect();
  const headerId = c.req.header(ACTIVE_BABY_HEADER);

  if (headerId) {
    if (!HEX_24.test(headerId)) {
      return c.json({ error: "baby_archived", id: headerId }, 410);
    }
    const doc = await BabyModel.findById(headerId).lean();
    if (!doc || doc.archivedAt != null) {
      return c.json({ error: "baby_archived", id: headerId }, 410);
    }
    const baby = serializeBaby(doc);
    c.set("baby", baby);
    c.header("X-Active-Baby-Id", baby._id);
    await next();
    return;
  }

  const fallback = await BabyModel.findOne({ archivedAt: null })
    .sort({ createdAt: 1 })
    .lean();
  if (!fallback) {
    return c.json({ error: "no_active_baby" }, 412);
  }
  const baby = serializeBaby(fallback);
  c.set("baby", baby);
  c.header("X-Active-Baby-Id", baby._id);
  await next();
};

export function activeBabyObjectId(babyId: string): Types.ObjectId {
  return new Types.ObjectId(babyId);
}
