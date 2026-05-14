import { HydrationBoundary } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { prefetchOnServer } from "@/lib/rq/serverPrefetch";
import { fetchWeights } from "@/lib/api/feedings";
import {
  weightsAnalyticsKey,
  weightsKey,
} from "@/components/day-view/feedingsKey";
import { buildAnalytics } from "@/lib/who/analytics";
import { WeightModel } from "@/models/weight";
import { Types } from "mongoose";
import { dbConnect } from "@/lib/mongodb";
import { serializeWeight } from "@/lib/api/feedings";
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
    await qc.prefetchQuery({
      queryKey: weightsAnalyticsKey(active.baby._id),
      queryFn: async () => {
        await dbConnect();
        const docs = await WeightModel.find({
          babyId: new Types.ObjectId(active.baby._id),
        })
          .sort({ date: 1 })
          .lean();
        const weights = (
          docs as unknown as Parameters<typeof serializeWeight>[0][]
        ).map(serializeWeight);
        return buildAnalytics(active.baby, weights, tz);
      },
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
