import {
  vapidPublicKeyResponseSchema,
  pushStatusResponseSchema,
  type PushStatusResponse,
} from "@leon/schemas/push";
import { http } from "~/lib/http/client";

// All push network calls go through the shared `http` client so they respect
// VITE_API_URL / headers — never raw fetch("/api/...") (invariant: web talks to
// the Fly origin, which owns the reminder worker).

export async function getVapidPublicKey(): Promise<string> {
  const res = await http.get("/api/push/vapid-public-key");
  return vapidPublicKeyResponseSchema.parse(res.data).publicKey;
}

export async function subscribePush(body: {
  subscription: PushSubscriptionJSON;
  babyIds: string[];
}): Promise<void> {
  await http.post("/api/push/subscribe", body);
}

export async function unsubscribePush(endpoint: string): Promise<void> {
  await http.delete("/api/push/subscribe", { data: { endpoint } });
}

export async function getPushStatus(
  endpoint: string,
): Promise<PushStatusResponse> {
  const res = await http.get("/api/push/status", { params: { endpoint } });
  return pushStatusResponseSchema.parse(res.data);
}

// Browser PushSubscription.toJSON() shape — kept local to avoid importing the
// zod schema's inferred type at call sites.
type PushSubscriptionJSON = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};
