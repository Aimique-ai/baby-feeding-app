import { Schema, Types, type InferSchemaType } from "mongoose";
import { registerModel } from "@/lib/db/registerModel";

const MedicationSchema = new Schema(
  {
    babyId: {
      type: Schema.Types.ObjectId,
      ref: "Baby",
      required: true,
    },
    name: { type: String, required: true },
    defaultDoseDrops: { type: Number, required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

MedicationSchema.index({ babyId: 1, deletedAt: 1, createdAt: 1 });
MedicationSchema.index(
  { babyId: 1, name: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: null },
    collation: { locale: "en", strength: 2 },
  },
);

export type Medication = InferSchemaType<typeof MedicationSchema> & {
  _id: Types.ObjectId;
};
export const MedicationModel = registerModel<Medication>(
  "Medication",
  MedicationSchema,
);
