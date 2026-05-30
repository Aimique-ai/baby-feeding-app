import { z } from "zod";
import { weightResponseSchema, type Weight } from "@leon/schemas/weight";
import type { WeightsAnalytics } from "@leon/domain/who/types";
import { http } from "~/lib/http/client";

export async function listWeights(): Promise<Weight[]> {
  const res = await http.get("/api/weights");
  return z.array(weightResponseSchema).parse(res.data);
}

export async function createWeight(body: unknown): Promise<Weight> {
  const res = await http.post("/api/weights", body);
  return weightResponseSchema.parse(res.data);
}

export async function patchWeight(id: string, body: unknown): Promise<Weight> {
  const res = await http.patch(`/api/weights/${id}`, body);
  return weightResponseSchema.parse(res.data);
}

export async function deleteWeight(id: string): Promise<void> {
  await http.delete(`/api/weights/${id}`);
}

export async function getWeightsAnalytics(): Promise<WeightsAnalytics> {
  const res = await http.get<WeightsAnalytics>("/api/weights/analytics");
  return res.data;
}
