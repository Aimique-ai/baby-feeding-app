import { Schema, Types, type InferSchemaType } from "mongoose";
import { registerModel } from "@/lib/db/registerModel";

const FormulaSchema = new Schema(
  {
    name: { type: String, required: true },
    brand: { type: String },
    kcalPer100mlReady: { type: Number, required: true, min: 40, max: 100 },
    proteinGPer100kcal: { type: Number, required: true, min: 0.5, max: 5 },
    proteinGPer100mlReady: { type: Number, min: 0.5, max: 5 },
    stage: { type: Number, default: 1 },
    kind: { type: String, enum: ["standard"], default: "standard" },
    isSystem: { type: Boolean, default: false },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

FormulaSchema.index({ archivedAt: 1, name: 1 });

export type Formula = InferSchemaType<typeof FormulaSchema> & {
  _id: Types.ObjectId;
};
export const FormulaModel = registerModel<Formula>("Formula", FormulaSchema);
