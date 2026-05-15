import { HydrationBoundary } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { prefetchOnServer } from "@/lib/rq/serverPrefetch";
import { getTzFromCookie } from "@/lib/api/tz";
import {
  fetchFeedingsForDay,
  fetchWeights,
  fetchLastFeedingBefore,
} from "@/lib/api/feedings";
import { resolveActiveBaby } from "@/lib/api/activeBaby";
import {
  babyKey,
  feedingsKey,
  weightsKey,
} from "@/components/day-view/feedingsKey";
import { startOfLocalDay, localDateISO } from "@/lib/planning/dayBoundary";
import { DayViewWithSheet } from "@/components/day-view/DayViewWithSheet";
import { BabyCookieSeeder } from "@/components/BabyCookieSeeder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const active = await resolveActiveBaby();
  if (!active) redirect("/babies");

  const tz = await getTzFromCookie();
  const dateISO = localDateISO(new Date(), tz);
  const dayStart = startOfLocalDay(dateISO, tz);

  const { state } = await prefetchOnServer(async (qc) => {
    qc.setQueryData(babyKey(active.baby._id), active.baby);
    await Promise.all([
      qc.prefetchQuery({
        queryKey: feedingsKey(active.baby._id, dateISO, tz),
        queryFn: () => fetchFeedingsForDay(dateISO, tz, active.baby._id),
      }),
      qc.prefetchQuery({
        queryKey: weightsKey(active.baby._id),
        queryFn: () => fetchWeights(active.baby._id),
      }),
    ]);
  });

  const prev = await fetchLastFeedingBefore(dayStart, active.baby._id);

  return (
    <HydrationBoundary state={state}>
      {active.source === "fallback" && (
        <BabyCookieSeeder babyId={active.baby._id} />
      )}
      <DayViewWithSheet
        mode="live"
        dateISO={dateISO}
        tz={tz}
        babyId={active.baby._id}
        prevDayAnchor={prev?.startAt ?? null}
      />
    </HydrationBoundary>
  );
}
