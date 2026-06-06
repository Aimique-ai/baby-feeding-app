import { z } from "zod";
import { objectIdString } from "./objectId";

// Shape of the browser's `PushSubscription.toJSON()` — `{ endpoint, keys }`.
// `expirationTime` exists on the browser object but we don't store it.
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

export type PushSubscriptionJSON = z.infer<typeof pushSubscriptionSchema>;

// POST /api/push/subscribe body. `babyIds` is the explicit device→babies link;
// the server filters it to existing non-archived babies before upsert.
export const subscribeRequestSchema = z.object({
  subscription: pushSubscriptionSchema,
  babyIds: z.array(objectIdString),
});

export type SubscribeRequest = z.infer<typeof subscribeRequestSchema>;

export const unsubscribeRequestSchema = z.object({
  endpoint: z.string().url(),
});

export type UnsubscribeRequest = z.infer<typeof unsubscribeRequestSchema>;

// GET /api/push/vapid-public-key
export const vapidPublicKeyResponseSchema = z.object({
  publicKey: z.string(),
});

export type VapidPublicKeyResponse = z.infer<
  typeof vapidPublicKeyResponseSchema
>;

// GET /api/push/status?endpoint=
export const pushStatusResponseSchema = z.object({
  subscribed: z.boolean(),
  babyIds: z.array(objectIdString),
});

export type PushStatusResponse = z.infer<typeof pushStatusResponseSchema>;
