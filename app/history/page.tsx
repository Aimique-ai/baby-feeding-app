import { redirect } from "next/navigation";
import { resolveActiveBaby } from "@/lib/api/activeBaby";
import { HistoryList } from "@/components/history/HistoryList";
import { BabyCookieSeeder } from "@/components/BabyCookieSeeder";
import { getTzFromCookie } from "@/lib/api/tz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const active = await resolveActiveBaby();
  if (!active) redirect("/babies");
  const tz = await getTzFromCookie();

  return (
    <>
      {active.source === "fallback" && (
        <BabyCookieSeeder babyId={active.baby._id} />
      )}
      <HistoryList tz={tz} />
    </>
  );
}
