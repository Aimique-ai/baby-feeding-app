import { dbConnect } from "@/lib/mongodb";
import { BabyModel } from "@/models/baby";
import { serializeBaby } from "@/lib/api/activeBaby";
import { ArchivedBabyList } from "@/components/babies/ArchivedBabyList";
import { getTzFromCookie } from "@/lib/api/tz";

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
  const tz = await getTzFromCookie();

  return <ArchivedBabyList babies={babies} tz={tz} />;
}
