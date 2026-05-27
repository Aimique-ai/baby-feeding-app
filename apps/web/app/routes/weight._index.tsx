import { Navigate, useLoaderData } from "react-router";
import { http } from "~/lib/http/client";
import { WeightList } from "@/components/weight/WeightList";
import { WeightTabs } from "@/components/weight/WeightTabs";
import type { SerializedBaby } from "@leon/contracts/serialized";
import { ensureActiveBabyId } from "~/lib/baby/ensureActive";
import { getBrowserTz } from "~/lib/time/browserTz";

export function meta() {
  return [{ title: "Вес — Leon" }];
}

type LoaderData = {
  babyId: string | null;
  tz: string;
  birthDate: string | null;
};

export async function clientLoader(): Promise<LoaderData> {
  const tz = getBrowserTz();
  const babyId = await ensureActiveBabyId();
  if (!babyId) return { babyId: null, tz, birthDate: null };
  // ensureActiveBabyId already called /api/baby on cold cache; this re-call is
  // cheap (React Query staleTime not in scope here) and gives us birthDate.
  const res = await http.get<SerializedBaby>("/api/baby");
  return { babyId, tz, birthDate: res.data.birthDate };
}

export default function WeightPage() {
  const { babyId, tz, birthDate } = useLoaderData<typeof clientLoader>();
  if (!babyId || !birthDate) return <Navigate to="/babies" replace />;
  return (
    <div className="mx-auto max-w-screen-sm px-4 py-4">
      <WeightTabs />
      <div className="mt-4">
        <WeightList tz={tz} babyId={babyId} birthDate={birthDate} />
      </div>
    </div>
  );
}
