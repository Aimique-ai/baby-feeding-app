import { HydrationBoundary } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { prefetchOnServer } from "@/lib/rq/serverPrefetch";
import { fetchWeights } from "@/lib/api/feedings";
import { weightsKey } from "@/components/day-view/feedingsKey";
import { WeightList } from "@/components/weight/WeightList";
import { getTzFromCookie } from "@/lib/api/tz";
import { resolveActiveBaby } from "@/lib/api/activeBaby";
import { BabyCookieSeeder } from "@/components/BabyCookieSeeder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function WeightPage() {
  const active = await resolveActiveBaby();
  if (!active) redirect("/babies");

  const tz = await getTzFromCookie();
  const { state } = await prefetchOnServer(async (qc) => {
    await qc.prefetchQuery({
      queryKey: weightsKey(active.baby._id),
      queryFn: () => fetchWeights(active.baby._id),
    });
  });
  return (
    <HydrationBoundary state={state}>
      {active.source === "fallback" && (
        <BabyCookieSeeder babyId={active.baby._id} />
      )}
      <WeightList tz={tz} babyId={active.baby._id} />
    </HydrationBoundary>
  );
}
