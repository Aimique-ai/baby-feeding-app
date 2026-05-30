import { z } from "zod";
import { formulaResponseSchema, type Formula } from "@leon/schemas/formula";
import { http } from "~/lib/http/client";

export async function listFormulas(): Promise<Formula[]> {
  const res = await http.get("/api/formulas");
  return z.array(formulaResponseSchema).parse(res.data);
}
