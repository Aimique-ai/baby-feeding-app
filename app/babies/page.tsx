import { dbConnect } from "@/lib/mongodb";
import { BabyModel } from "@/models/baby";
import { serializeBaby, resolveActiveBaby } from "@/lib/api/activeBaby";
import { BabyList } from "@/components/babies/BabyList";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function BabiesPage() {
  await dbConnect();
  const docs = await BabyModel.find({ archivedAt: null })
    .sort({ createdAt: 1 })
    .lean();
  const babies = (
    docs as unknown as Parameters<typeof serializeBaby>[0][]
  ).map(serializeBaby);

  const active = await resolveActiveBaby();

  return (
    <BabyList
      babies={babies}
      activeBabyId={active?.baby._id ?? null}
    />
  );
}
