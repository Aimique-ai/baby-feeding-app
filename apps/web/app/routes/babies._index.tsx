import { useLoaderData } from "react-router";
import { http } from "~/lib/http/client";
import { BabyList } from "~/features/BabyList";
import type { Baby } from "@leon/schemas/baby";
import { readActiveBabyId } from "~/lib/baby/active";
import { getBrowserTz } from "~/lib/time/browserTz";

export function meta() {
  return [{ title: "Дети — Leon" }];
}

type LoaderData = {
  babies: Baby[];
  activeBabyId: string | null;
  tz: string;
};

export async function clientLoader(): Promise<LoaderData> {
  const tz = getBrowserTz();
  const res = await http.get<Baby[]>("/api/babies");
  return {
    babies: res.data,
    activeBabyId: readActiveBabyId(),
    tz,
  };
}

export default function BabiesPage() {
  const { babies, activeBabyId, tz } = useLoaderData<typeof clientLoader>();
  return <BabyList babies={babies} activeBabyId={activeBabyId} tz={tz} />;
}
