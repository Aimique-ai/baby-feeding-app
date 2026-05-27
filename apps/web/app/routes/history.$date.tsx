import { Navigate, useLoaderData, useParams } from "react-router";
import { startOfLocalDay } from "@leon/domain/planning/dayBoundary";
import { DayViewWithSheet } from "@/components/day-view/DayViewWithSheet";
import { fetchLastFeedingBefore } from "~/lib/api/feedings";
import type { SerializedFeeding } from "@leon/contracts/serialized";
import { ensureActiveBabyId } from "~/lib/baby/ensureActive";
import { getBrowserTz } from "~/lib/time/browserTz";

export function meta({ params }: { params: { date?: string } }) {
  return [{ title: `${params.date ?? "День"} — Leon` }];
}

type LoaderData = {
  babyId: string | null;
  tz: string;
  prevMainCandidates: SerializedFeeding[];
};

export async function clientLoader({
  params,
}: {
  params: { date?: string };
}): Promise<LoaderData> {
  const tz = getBrowserTz();
  const dateISO = params.date ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
    return { babyId: null, tz, prevMainCandidates: [] };
  }
  const babyId = await ensureActiveBabyId();
  if (!babyId) return { babyId: null, tz, prevMainCandidates: [] };
  const dayStart = startOfLocalDay(dateISO, tz);
  const prevMainCandidates = await fetchLastFeedingBefore(dayStart, babyId);
  return { babyId, tz, prevMainCandidates };
}

export default function HistoryDayPage() {
  const { date } = useParams<{ date: string }>();
  const { babyId, tz, prevMainCandidates } =
    useLoaderData<typeof clientLoader>();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return <Navigate to="/history" replace />;
  }
  if (!babyId) return <Navigate to="/babies" replace />;
  return (
    <DayViewWithSheet
      mode="historical"
      dateISO={date}
      tz={tz}
      babyId={babyId}
      prevMainCandidates={prevMainCandidates}
    />
  );
}
