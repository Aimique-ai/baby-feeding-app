import { HydrationBoundary } from "@tanstack/react-query";
import { notFound, redirect } from "next/navigation";
import { prefetchOnServer } from "@/lib/rq/serverPrefetch";
import { getTzFromCookie } from "@/lib/api/tz";
import {
  fetchFeedingsForDay,
  fetchWeights,
  fetchLastFeedingBefore,
} from "@/lib/api/feedings";
import { resolveActiveBaby } from "@/lib/api/activeBaby";
import { serializeBabyWithFormula } from "@/lib/api/serializeBabyWithFormula";
import {
  babyKey,
  feedingsKey,
  weightsKey,
} from "@/components/day-view/feedingsKey";
import { startOfLocalDay } from "@/lib/planning/dayBoundary";
import { DayViewWithSheet } from "@/components/day-view/DayViewWithSheet";
import { BabyCookieSeeder } from "@/components/BabyCookieSeeder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function HistoryDayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date: dateISO } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) notFound();

  const active = await resolveActiveBaby();
  if (!active) redirect("/babies");

  const tz = await getTzFromCookie();
  const dayStart = startOfLocalDay(dateISO, tz);

  const babyWithFormula = await serializeBabyWithFormula(active.baby);

  const { state } = await prefetchOnServer(async (qc) => {
    qc.setQueryData(babyKey(active.baby._id), babyWithFormula);
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
        mode="historical"
        dateISO={dateISO}
        tz={tz}
        babyId={active.baby._id}
        prevMainAnchor={prev?.startAt ?? null}
      />
    </HydrationBoundary>
  );
}
