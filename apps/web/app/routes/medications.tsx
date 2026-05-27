import { Navigate, useLoaderData } from "react-router";
import { MedicationList } from "@/components/medications/MedicationList";
import { ensureActiveBabyId } from "~/lib/baby/ensureActive";

export function meta() {
  return [{ title: "Лекарства — Leon" }];
}

type LoaderData = { babyId: string | null };

export async function clientLoader(): Promise<LoaderData> {
  const babyId = await ensureActiveBabyId();
  return { babyId };
}

export default function MedicationsPage() {
  const { babyId } = useLoaderData<typeof clientLoader>();
  if (!babyId) return <Navigate to="/babies" replace />;
  return <MedicationList babyId={babyId} />;
}
