import { http } from "~/lib/http/client";

export type HistoryDayItem = {
  dateISO: string;
  dol: number;
  target: number;
  factOfDay: number;
  feedingsCount: number;
  topUpsCount: number;
  avgDurationMs: number | null;
  deficit: number;
};

export type HistoryPage = {
  items: HistoryDayItem[];
  nextCursor: string | null;
};

export async function fetchHistoryPage(
  cursor: string | null,
): Promise<HistoryPage> {
  const res = await http.get<HistoryPage>("/api/history", {
    params: cursor ? { cursor } : undefined,
  });
  return res.data;
}
