import { HydrationBoundary } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { Types } from "mongoose";
import { prefetchOnServer } from "@/lib/rq/serverPrefetch";
import { weightsAnalyticsKey } from "@/components/day-view/feedingsKey";
import { buildAnalytics } from "@/lib/who/analytics";
import { WeightModel } from "@/models/weight";
import { dbConnect } from "@/lib/mongodb";
import { serializeWeight } from "@/lib/api/feedings";
import { WeightAnalytics } from "@/components/weight/WeightAnalytics";
import { WeightTabs } from "@/components/weight/WeightTabs";
import { getTzFromCookie } from "@/lib/api/tz";
import { resolveActiveBaby } from "@/lib/api/activeBaby";
import { BabyCookieSeeder } from "@/components/BabyCookieSeeder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function WeightAnalyticsPage() {
  const active = await resolveActiveBaby();
  if (!active) redirect("/babies");

  const tz = await getTzFromCookie();
  const { state } = await prefetchOnServer(async (qc) => {
    await qc.prefetchQuery({
      queryKey: weightsAnalyticsKey(active.baby._id, tz),
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
      <div className="mx-auto max-w-screen-sm px-4 py-4">
        <WeightTabs />
        <div className="mt-4">
          <WeightAnalytics babyId={active.baby._id} tz={tz} />
        </div>
      </div>
    </HydrationBoundary>
  );
}
