import type { SerializedFeeding } from "@leon/contracts/serialized";
import { http } from "~/lib/http/client";

export async function fetchLastFeedingBefore(
  at: Date,
  _babyId: string,
  limit = 5,
): Promise<SerializedFeeding[]> {
  const res = await http.get<SerializedFeeding[]>("/api/feedings/last-before", {
    params: { at: at.toISOString(), limit },
  });
  return res.data;
}

export async function listFeedingsByDate(
  dateISO: string,
): Promise<SerializedFeeding[]> {
  const res = await http.get<SerializedFeeding[]>("/api/feedings", {
    params: { date: dateISO },
  });
  return res.data;
}

export async function createFeeding(body: unknown): Promise<SerializedFeeding> {
  const res = await http.post<SerializedFeeding>("/api/feedings", body);
  return res.data;
}

export async function patchFeeding(
  id: string,
  body: unknown,
): Promise<SerializedFeeding> {
  const res = await http.patch<SerializedFeeding>(`/api/feedings/${id}`, body);
  return res.data;
}

export async function deleteFeeding(id: string): Promise<void> {
  await http.delete(`/api/feedings/${id}`);
}

export async function fetchDurationChips(): Promise<number[] | null> {
  try {
    const res = await http.get<{ chips: number[] }>(
      "/api/feedings/analytics/duration-chips",
    );
    return res.data.chips;
  } catch {
    return null;
  }
}

type FeedingsAnalyticsItem = {
  dateISO: string;
  dol: number;
  target: number | null;
  mode: "neonatal" | "energy";
  fact: number;
};

export type FeedingsAnalyticsResponse = {
  tz: string;
  items: FeedingsAnalyticsItem[];
};

export async function getFeedingsAnalytics(): Promise<FeedingsAnalyticsResponse> {
  const res = await http.get<FeedingsAnalyticsResponse>(
    "/api/feedings/analytics",
  );
  return res.data;
}
