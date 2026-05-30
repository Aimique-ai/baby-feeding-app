import { z } from "zod";
import { feedingResponseSchema, type Feeding } from "@leon/schemas/feeding";
import {
  feedingsAnalyticsResponseSchema,
  type FeedingsAnalyticsResponse,
  durationChipsSchema,
} from "@leon/schemas/analytics";
import { http } from "~/lib/http/client";

export async function fetchLastFeedingBefore(
  at: Date,
  _babyId: string,
  limit = 5,
): Promise<Feeding[]> {
  const res = await http.get("/api/feedings/last-before", {
    params: { at: at.toISOString(), limit },
  });
  return z.array(feedingResponseSchema).parse(res.data);
}

export async function listFeedingsByDate(
  dateISO: string,
): Promise<Feeding[]> {
  const res = await http.get("/api/feedings", {
    params: { date: dateISO },
  });
  return z.array(feedingResponseSchema).parse(res.data);
}

export async function createFeeding(body: unknown): Promise<Feeding> {
  const res = await http.post("/api/feedings", body);
  return feedingResponseSchema.parse(res.data);
}

export async function patchFeeding(
  id: string,
  body: unknown,
): Promise<Feeding> {
  const res = await http.patch(`/api/feedings/${id}`, body);
  return feedingResponseSchema.parse(res.data);
}

export async function deleteFeeding(id: string): Promise<void> {
  await http.delete(`/api/feedings/${id}`);
}

export async function fetchDurationChips(): Promise<number[] | null> {
  try {
    const res = await http.get("/api/feedings/analytics/duration-chips");
    return durationChipsSchema.parse(res.data).chips;
  } catch {
    return null;
  }
}

export async function getFeedingsAnalytics(): Promise<FeedingsAnalyticsResponse> {
  const res = await http.get("/api/feedings/analytics");
  return feedingsAnalyticsResponseSchema.parse(res.data);
}
