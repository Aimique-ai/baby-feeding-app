import type {
  SerializedBaby,
  SerializedBabyWithFormula,
} from "@leon/contracts/serialized";
import { http } from "~/lib/http/client";

export async function listBabies(opts?: {
  includeArchived?: boolean;
}): Promise<SerializedBaby[]> {
  const res = await http.get<SerializedBaby[]>("/api/babies", {
    params: opts?.includeArchived ? { includeArchived: true } : undefined,
  });
  return res.data;
}

export async function getActiveBaby(): Promise<SerializedBabyWithFormula> {
  const res = await http.get<SerializedBabyWithFormula>("/api/baby");
  return res.data;
}

export async function createBaby(
  body: unknown,
): Promise<SerializedBaby> {
  const res = await http.post<SerializedBaby>("/api/babies", body);
  return res.data;
}

export async function patchBaby(
  id: string,
  body: unknown,
): Promise<SerializedBaby> {
  const res = await http.patch<SerializedBaby>(`/api/babies/${id}`, body);
  return res.data;
}

export async function archiveBaby(id: string): Promise<void> {
  await http.delete(`/api/babies/${id}`);
}

export async function restoreBaby(id: string): Promise<void> {
  await http.post(`/api/babies/${id}/restore`);
}
