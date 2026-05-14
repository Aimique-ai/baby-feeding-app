import { dbConnect } from "@/lib/mongodb";
import { BabyModel } from "@/models/baby";
import { serializeBaby } from "@/lib/api/activeBaby";
import { ArchivedBabyList } from "@/components/babies/ArchivedBabyList";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function BabiesArchivePage() {
  await dbConnect();
  const docs = await BabyModel.find({ archivedAt: { $ne: null } })
    .sort({ createdAt: 1 })
    .lean();
  const babies = (
    docs as unknown as Parameters<typeof serializeBaby>[0][]
  ).map(serializeBaby);

  return <ArchivedBabyList babies={babies} />;
}
