import { z } from "zod";
import {
  babyResponseSchema,
  babyWithFormulaResponseSchema,
  type Baby,
  type BabyWithFormula,
} from "@leon/schemas/baby";
import { http } from "~/lib/http/client";

export async function listBabies(opts?: {
  includeArchived?: boolean;
}): Promise<Baby[]> {
  const res = await http.get("/api/babies", {
    params: opts?.includeArchived ? { includeArchived: true } : undefined,
  });
  return z.array(babyResponseSchema).parse(res.data);
}

export async function getActiveBaby(): Promise<BabyWithFormula> {
  const res = await http.get("/api/baby");
  return babyWithFormulaResponseSchema.parse(res.data);
}

export async function createBaby(body: unknown): Promise<Baby> {
  const res = await http.post("/api/babies", body);
  return babyResponseSchema.parse(res.data);
}

export async function patchBaby(id: string, body: unknown): Promise<Baby> {
  const res = await http.patch(`/api/babies/${id}`, body);
  return babyResponseSchema.parse(res.data);
}

export async function archiveBaby(id: string): Promise<void> {
  await http.delete(`/api/babies/${id}`);
}

export async function restoreBaby(id: string): Promise<void> {
  await http.post(`/api/babies/${id}/restore`);
}
