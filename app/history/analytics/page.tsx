import { redirect } from "next/navigation";
import { resolveActiveBaby } from "@/lib/api/activeBaby";
import { FeedingTargetChart } from "@/components/history/FeedingTargetChart";
import { HistoryTabs } from "@/components/history/HistoryTabs";
import { BabyCookieSeeder } from "@/components/BabyCookieSeeder";
import { getTzFromCookie } from "@/lib/api/tz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function HistoryAnalyticsPage() {
  const active = await resolveActiveBaby();
  if (!active) redirect("/babies");
  const tz = await getTzFromCookie();

  return (
    <>
      {active.source === "fallback" && (
        <BabyCookieSeeder babyId={active.baby._id} />
      )}
      <div className="mx-auto max-w-screen-sm px-4 py-4">
        <HistoryTabs />
        <div className="mt-4">
          <FeedingTargetChart babyId={active.baby._id} tz={tz} />
        </div>
      </div>
    </>
  );
}
