import { Schema, Types, type InferSchemaType } from "mongoose";
import { registerModel } from "@/lib/db/registerModel";

const BabySchema = new Schema(
  {
    name: { type: String, required: true },
    birthDate: { type: Date, required: true },
    birthWeightGrams: { type: Number, required: true },
    sex: {
      type: String,
      enum: ["male", "female"],
      required: true,
      default: "male",
    },
    currentFormulaId: {
      type: Schema.Types.ObjectId,
      ref: "Formula",
      default: null,
    },
    preferredFeedCount: { type: Number, default: null },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

BabySchema.index({ archivedAt: 1, createdAt: 1 });
BabySchema.index(
  { name: 1 },
  {
    unique: true,
    partialFilterExpression: { archivedAt: null },
    collation: { locale: "en", strength: 2 },
  },
);

export type Baby = InferSchemaType<typeof BabySchema> & {
  _id: Types.ObjectId;
};
export const BabyModel = registerModel<Baby>("Baby", BabySchema);
