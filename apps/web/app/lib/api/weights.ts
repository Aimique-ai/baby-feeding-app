import type { SerializedWeight } from "@leon/contracts/serialized";
import type { WeightsAnalytics } from "@leon/domain/who/types";
import { http } from "~/lib/http/client";

export async function listWeights(): Promise<SerializedWeight[]> {
  const res = await http.get<SerializedWeight[]>("/api/weights");
  return res.data;
}

export async function createWeight(body: unknown): Promise<SerializedWeight> {
  const res = await http.post<SerializedWeight>("/api/weights", body);
  return res.data;
}

export async function patchWeight(
  id: string,
  body: unknown,
): Promise<SerializedWeight> {
  const res = await http.patch<SerializedWeight>(`/api/weights/${id}`, body);
  return res.data;
}

export async function deleteWeight(id: string): Promise<void> {
  await http.delete(`/api/weights/${id}`);
}

export async function getWeightsAnalytics(): Promise<WeightsAnalytics> {
  const res = await http.get<WeightsAnalytics>("/api/weights/analytics");
  return res.data;
}
