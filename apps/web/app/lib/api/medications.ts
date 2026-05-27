import type { SerializedMedication } from "@leon/contracts/serialized";
import { http } from "~/lib/http/client";

export async function listMedications(): Promise<SerializedMedication[]> {
  const res = await http.get<SerializedMedication[]>("/api/medications");
  return res.data;
}

export async function getMedication(
  id: string,
): Promise<SerializedMedication> {
  const res = await http.get<SerializedMedication>(`/api/medications/${id}`);
  return res.data;
}

export async function createMedication(
  body: unknown,
): Promise<SerializedMedication> {
  const res = await http.post<SerializedMedication>("/api/medications", body);
  return res.data;
}

export async function patchMedication(
  id: string,
  body: unknown,
): Promise<SerializedMedication> {
  const res = await http.patch<SerializedMedication>(
    `/api/medications/${id}`,
    body,
  );
  return res.data;
}

export async function deleteMedication(id: string): Promise<void> {
  await http.delete(`/api/medications/${id}`);
}
