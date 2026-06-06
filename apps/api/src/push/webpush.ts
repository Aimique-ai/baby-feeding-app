import webpush, { WebPushError } from "web-push";
import { Types } from "mongoose";
import { dbConnect } from "../db/mongo.js";
import { PushSubscriptionModel } from "../models/pushSubscription.js";

// VAPID details are set once at module init from env. Missing keys is a loud,
// not silent, failure (Principle 4) — without them sendNotification throws and
// reminders die quietly otherwise.
const PUBLIC = process.env.VAPID_PUBLIC_KEY;
const PRIVATE = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT;

let vapidReady = false;
if (PUBLIC && PRIVATE && SUBJECT) {
  webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE);
  vapidReady = true;
} else {
  console.error(
    "[push] VAPID keys missing (VAPID_PUBLIC_KEY/PRIVATE_KEY/SUBJECT) — push delivery DISABLED",
  );
}

export type PushPayload = {
  title: string;
  body: string;
  babyId: string;
  url: string;
};

/**
 * Deliver `payload` to every subscription linked to `babyId`. Stale endpoints
 * (404/410 from the push service) are pruned. Other send errors are logged but
 * never thrown — one dead device must not abort the rest.
 */
export async function sendPushToBaby(
  babyId: string,
  payload: PushPayload,
): Promise<void> {
  if (!vapidReady) {
    console.error("[push] send skipped — VAPID not configured");
    return;
  }
  await dbConnect();
  const subs = await PushSubscriptionModel.find({
    babyIds: new Types.ObjectId(babyId),
  }).lean();
  if (subs.length === 0) return;

  const body = JSON.stringify(payload);
  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        body,
      ),
    ),
  );

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled") continue;
    const err = r.reason;
    const endpoint = subs[i].endpoint;
    if (err instanceof WebPushError && (err.statusCode === 404 || err.statusCode === 410)) {
      await PushSubscriptionModel.deleteOne({ endpoint });
      console.warn(`[push] pruned stale subscription (${err.statusCode})`);
    } else {
      console.error("[push] send failed", err);
    }
  }
}
