import { historyPageSchema, type HistoryPage } from "@leon/schemas/analytics";
import { http } from "~/lib/http/client";

export async function fetchHistoryPage(
  cursor: string | null,
): Promise<HistoryPage> {
  const res = await http.get("/api/history", {
    params: cursor ? { cursor } : undefined,
  });
  return historyPageSchema.parse(res.data);
}
