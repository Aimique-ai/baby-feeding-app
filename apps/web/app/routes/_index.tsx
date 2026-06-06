import { Navigate, useLoaderData } from "react-router";
import { localDateISO } from "@leon/domain/planning/dayBoundary";
import { DayViewWithSheet } from "~/features/DayViewWithSheet";
import { ensureActiveBabyId } from "~/lib/baby/ensureActive";
import { getBrowserTz } from "~/lib/time/browserTz";

export function meta() {
  return [{ title: "Сегодня — Leon" }];
}

type LoaderData = {
  babyId: string | null;
  dateISO: string;
  tz: string;
};

export async function clientLoader(): Promise<LoaderData> {
  const tz = getBrowserTz();
  const dateISO = localDateISO(new Date(), tz);
  const babyId = await ensureActiveBabyId();
  return { babyId, dateISO, tz };
}

export default function TodayPage() {
  const { babyId, dateISO, tz } = useLoaderData<typeof clientLoader>();
  if (!babyId) return <Navigate to="/babies" replace />;
  return (
    <DayViewWithSheet mode="live" dateISO={dateISO} tz={tz} babyId={babyId} />
  );
}
