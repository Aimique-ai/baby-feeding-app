import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { Types } from "mongoose";
import {
  subscribeRequestSchema,
  unsubscribeRequestSchema,
} from "@leon/schemas/push";
import { z } from "zod";
import { dbConnect } from "../db/mongo.js";
import { BabyModel } from "../models/baby.js";
import { PushSubscriptionModel } from "../models/pushSubscription.js";
import { sendPushToBaby } from "../push/webpush.js";
import { getReminderQueue } from "../scheduler/queue.js";
import type { AppEnv } from "../types.js";

// Device-centric, mounted OUTSIDE babyScoped — no active-baby context here.
// Subscribe/test take babyIds explicitly in the body.
export const pushRoute = new Hono<AppEnv>();

pushRoute.get("/vapid-public-key", (c) => {
  const publicKey = process.env.VAPID_PUBLIC_KEY ?? "";
  return c.json({ publicKey });
});

pushRoute.post(
  "/subscribe",
  zValidator("json", subscribeRequestSchema),
  async (c) => {
    const { subscription, babyIds } = c.req.valid("json");
    await dbConnect();

    const objIds = babyIds.map((id) => new Types.ObjectId(id));
    const valid = await BabyModel.find({
      _id: { $in: objIds },
      archivedAt: null,
    })
      .select("_id")
      .lean();
    if (valid.length === 0) {
      return c.json({ error: "no_valid_babies" }, 400);
    }
    const validIds = valid.map((b) => b._id);

    const existing = await PushSubscriptionModel.findOne({
      endpoint: subscription.endpoint,
    }).lean();

    await PushSubscriptionModel.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        babyIds: validIds,
      },
      { upsert: true, new: true },
    );
    return c.json({ ok: true }, existing ? 200 : 201);
  },
);

pushRoute.delete(
  "/subscribe",
  zValidator("json", unsubscribeRequestSchema),
  async (c) => {
    const { endpoint } = c.req.valid("json");
    await dbConnect();
    await PushSubscriptionModel.deleteOne({ endpoint });
    return c.json({ ok: true });
  },
);

pushRoute.get("/status", async (c) => {
  const endpoint = c.req.query("endpoint");
  if (!endpoint) {
    return c.json({ error: "missing_endpoint" }, 400);
  }
  await dbConnect();
  const sub = await PushSubscriptionModel.findOne({ endpoint }).lean();
  return c.json({
    subscribed: !!sub,
    babyIds: sub ? sub.babyIds.map((id) => id.toString()) : [],
  });
});

// Debug-only: fire a push immediately to verify the delivery path without
// waiting for a scheduled reminder. Guarded by a shared secret (X-Debug-Secret).
const testRequestSchema = z.object({ babyId: z.string() });

pushRoute.post("/test", zValidator("json", testRequestSchema), async (c) => {
  const secret = process.env.PUSH_DEBUG_SECRET;
  if (!secret || c.req.header("X-Debug-Secret") !== secret) {
    return c.json({ error: "forbidden" }, 403);
  }
  const { babyId } = c.req.valid("json");
  if (!Types.ObjectId.isValid(babyId)) {
    return c.json({ error: "invalid_baby_id" }, 400);
  }
  await dbConnect();
  const baby = await BabyModel.findById(babyId).select("name").lean();
  const name = baby?.name ?? "малыш";
  await sendPushToBaby(babyId, {
    title: "Тест",
    body: `${name}: тестовое уведомление`,
    babyId,
    url: `/?baby=${babyId}`,
  });
  return c.json({ ok: true });
});

// Debug-only: enqueue a real delayed job through the queue so the full
// queue → worker → push path is exercised, not just direct delivery.
const enqueueRequestSchema = z.object({
  babyId: z.string(),
  delaySec: z.number().int().min(0).max(3600).default(10),
});

pushRoute.post(
  "/test-enqueue",
  zValidator("json", enqueueRequestSchema),
  async (c) => {
    const secret = process.env.PUSH_DEBUG_SECRET;
    if (!secret || c.req.header("X-Debug-Secret") !== secret) {
      return c.json({ error: "forbidden" }, 403);
    }
    const { babyId, delaySec } = c.req.valid("json");
    if (!Types.ObjectId.isValid(babyId)) {
      return c.json({ error: "invalid_baby_id" }, 400);
    }
    const queue = getReminderQueue();
    if (!queue) {
      return c.json({ error: "queue_unavailable" }, 503);
    }
    const now = new Date();
    await queue.add(
      "remind",
      {
        babyId,
        tz: "UTC",
        targetSlotISO: now.toISOString(),
        test: true,
      },
      {
        jobId: `test-${babyId}-${now.getTime()}`,
        delay: delaySec * 1000,
        removeOnComplete: true,
        removeOnFail: { count: 10 },
      },
    );
    return c.json({ ok: true, delaySec, message: "Message" });
  },
);
