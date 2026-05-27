import { Navigate, useLoaderData } from "react-router";
import { startOfLocalDay, localDateISO } from "@leon/domain/planning/dayBoundary";
import { DayViewWithSheet } from "@/components/day-view/DayViewWithSheet";
import { fetchLastFeedingBefore } from "~/lib/api/feedings";
import type { SerializedFeeding } from "@leon/contracts/serialized";
import { ensureActiveBabyId } from "~/lib/baby/ensureActive";
import { getBrowserTz } from "~/lib/time/browserTz";

export function meta() {
  return [{ title: "Сегодня — Leon" }];
}

type LoaderData = {
  babyId: string | null;
  dateISO: string;
  tz: string;
  prevMainCandidates: SerializedFeeding[];
};

export async function clientLoader(): Promise<LoaderData> {
  const tz = getBrowserTz();
  const dateISO = localDateISO(new Date(), tz);
  const babyId = await ensureActiveBabyId();
  if (!babyId) return { babyId: null, dateISO, tz, prevMainCandidates: [] };
  const dayStart = startOfLocalDay(dateISO, tz);
  const prevMainCandidates = await fetchLastFeedingBefore(dayStart, babyId);
  return { babyId, dateISO, tz, prevMainCandidates };
}

export default function TodayPage() {
  const { babyId, dateISO, tz, prevMainCandidates } =
    useLoaderData<typeof clientLoader>();
  if (!babyId) return <Navigate to="/babies" replace />;
  return (
    <DayViewWithSheet
      mode="live"
      dateISO={dateISO}
      tz={tz}
      babyId={babyId}
      prevMainCandidates={prevMainCandidates}
    />
  );
}
