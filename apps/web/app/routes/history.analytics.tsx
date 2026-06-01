import { Navigate, useLoaderData } from "react-router";
import { FeedingTargetChart } from "~/features/FeedingTargetChart";
import { HistoryTabs } from "~/features/HistoryTabs";
import { ensureActiveBabyId } from "~/lib/baby/ensureActive";
import { getBrowserTz } from "~/lib/time/browserTz";

export function meta() {
  return [{ title: "Аналитика истории — Leon" }];
}

type LoaderData = { babyId: string | null; tz: string };

export async function clientLoader(): Promise<LoaderData> {
  const tz = getBrowserTz();
  const babyId = await ensureActiveBabyId();
  return { babyId, tz };
}

export default function HistoryAnalyticsPage() {
  const { babyId, tz } = useLoaderData<typeof clientLoader>();
  if (!babyId) return <Navigate to="/babies" replace />;
  return (
    <div className="mx-auto max-w-screen-sm px-4 py-4">
      <HistoryTabs />
      <div className="mt-4">
        <FeedingTargetChart babyId={babyId} tz={tz} />
      </div>
    </div>
  );
}
