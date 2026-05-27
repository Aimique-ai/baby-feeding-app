import { Navigate, useLoaderData } from "react-router";
import { WeightAnalytics } from "@/components/weight/WeightAnalytics";
import { WeightTabs } from "@/components/weight/WeightTabs";
import { ensureActiveBabyId } from "~/lib/baby/ensureActive";
import { getBrowserTz } from "~/lib/time/browserTz";

export function meta() {
  return [{ title: "Аналитика веса — Leon" }];
}

type LoaderData = { babyId: string | null; tz: string };

export async function clientLoader(): Promise<LoaderData> {
  const tz = getBrowserTz();
  const babyId = await ensureActiveBabyId();
  return { babyId, tz };
}

export default function WeightAnalyticsPage() {
  const { babyId, tz } = useLoaderData<typeof clientLoader>();
  if (!babyId) return <Navigate to="/babies" replace />;
  return (
    <div className="mx-auto max-w-screen-sm px-4 py-4">
      <WeightTabs />
      <div className="mt-4">
        <WeightAnalytics babyId={babyId} tz={tz} />
      </div>
    </div>
  );
}
