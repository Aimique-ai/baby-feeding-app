import { HydrationBoundary } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { prefetchOnServer } from "@/lib/rq/serverPrefetch";
import { fetchActiveMedications } from "@/lib/api/medications";
import { medicationsKey } from "@/components/day-view/feedingsKey";
import { MedicationList } from "@/components/medications/MedicationList";
import { resolveActiveBaby } from "@/lib/api/activeBaby";
import { BabyCookieSeeder } from "@/components/BabyCookieSeeder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function MedicationsPage() {
  const active = await resolveActiveBaby();
  if (!active) redirect("/babies");

  const { state } = await prefetchOnServer(async (qc) => {
    await qc.prefetchQuery({
      queryKey: medicationsKey(active.baby._id),
      queryFn: () => fetchActiveMedications(active.baby._id),
    });
  });
  return (
    <HydrationBoundary state={state}>
      {active.source === "fallback" && (
        <BabyCookieSeeder babyId={active.baby._id} />
      )}
      <MedicationList babyId={active.baby._id} />
    </HydrationBoundary>
  );
}
