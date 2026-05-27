import type { SerializedFormula } from "@leon/contracts/serialized";
import { http } from "~/lib/http/client";

export async function listFormulas(): Promise<SerializedFormula[]> {
  const res = await http.get<SerializedFormula[]>("/api/formulas");
  return res.data;
}
