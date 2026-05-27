import { useLoaderData } from "react-router";
import { http } from "~/lib/http/client";
import { ArchivedBabyList } from "@/components/babies/ArchivedBabyList";
import type { SerializedBaby } from "@leon/contracts/serialized";
import { getBrowserTz } from "~/lib/time/browserTz";

export function meta() {
  return [{ title: "Архив детей — Leon" }];
}

type LoaderData = {
  babies: SerializedBaby[];
  tz: string;
};

export async function clientLoader(): Promise<LoaderData> {
  const tz = getBrowserTz();
  const res = await http.get<SerializedBaby[]>("/api/babies", {
    params: { includeArchived: true },
  });
  const archived = res.data.filter((b) => b.archivedAt != null);
  return { babies: archived, tz };
}

export default function BabiesArchivePage() {
  const { babies, tz } = useLoaderData<typeof clientLoader>();
  return <ArchivedBabyList babies={babies} tz={tz} />;
}
