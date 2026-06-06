import { Navigate, useLoaderData, useParams } from "react-router";
import { DayViewWithSheet } from "~/features/DayViewWithSheet";
import { ensureActiveBabyId } from "~/lib/baby/ensureActive";
import { getBrowserTz } from "~/lib/time/browserTz";

export function meta({ params }: { params: { date?: string } }) {
  return [{ title: `${params.date ?? "День"} — Leon` }];
}

type LoaderData = {
  babyId: string | null;
  tz: string;
};

export async function clientLoader({
  params,
}: {
  params: { date?: string };
}): Promise<LoaderData> {
  const tz = getBrowserTz();
  const dateISO = params.date ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
    return { babyId: null, tz };
  }
  const babyId = await ensureActiveBabyId();
  return { babyId, tz };
}

export default function HistoryDayPage() {
  const { date } = useParams<{ date: string }>();
  const { babyId, tz } = useLoaderData<typeof clientLoader>();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return <Navigate to="/history" replace />;
  }
  if (!babyId) return <Navigate to="/babies" replace />;
  return (
    <DayViewWithSheet mode="historical" dateISO={date} tz={tz} babyId={babyId} />
  );
}
