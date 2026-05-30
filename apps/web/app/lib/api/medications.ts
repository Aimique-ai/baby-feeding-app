import { z } from "zod";
import { medicationResponseSchema, type Medication } from "@leon/schemas/medication";
import { http } from "~/lib/http/client";

export async function listMedications(): Promise<Medication[]> {
  const res = await http.get("/api/medications");
  return z.array(medicationResponseSchema).parse(res.data);
}

export async function getMedication(
  id: string,
): Promise<Medication> {
  const res = await http.get(`/api/medications/${id}`);
  return medicationResponseSchema.parse(res.data);
}

export async function createMedication(
  body: unknown,
): Promise<Medication> {
  const res = await http.post("/api/medications", body);
  return medicationResponseSchema.parse(res.data);
}

export async function patchMedication(
  id: string,
  body: unknown,
): Promise<Medication> {
  const res = await http.patch(`/api/medications/${id}`, body);
  return medicationResponseSchema.parse(res.data);
}

export async function deleteMedication(id: string): Promise<void> {
  await http.delete(`/api/medications/${id}`);
}
