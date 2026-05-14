import "server-only";
import { Types } from "mongoose";
import { dbConnect } from "@/lib/mongodb";
import { MedicationModel } from "@/models/medication";
import type { SerializedMedication } from "./serializedTypes";

type MedicationDocLike = {
  _id: { toString(): string };
  babyId: { toString(): string };
  name: string;
  defaultDoseDrops: number;
  deletedAt: Date | null;
  createdAt: Date;
};

export function serializeMedication(
  doc: MedicationDocLike,
): SerializedMedication {
  return {
    _id: doc._id.toString(),
    babyId: doc.babyId.toString(),
    name: doc.name,
    defaultDoseDrops: doc.defaultDoseDrops,
    deletedAt: doc.deletedAt ? doc.deletedAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function fetchActiveMedications(
  babyId: string,
): Promise<SerializedMedication[]> {
  await dbConnect();
  const docs = await MedicationModel.find({
    babyId: new Types.ObjectId(babyId),
    deletedAt: null,
  })
    .sort({ createdAt: 1 })
    .lean();
  return (docs as unknown as MedicationDocLike[]).map(serializeMedication);
}
