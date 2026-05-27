import { Schema, Types, type InferSchemaType } from "mongoose";
import { registerModel } from "../db/registerModel.js";

const WeightSchema = new Schema(
  {
    babyId: {
      type: Schema.Types.ObjectId,
      ref: "Baby",
      required: true,
    },
    date: { type: Date, required: true },
    weightGrams: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

WeightSchema.index({ babyId: 1, date: 1 }, { unique: true });

export type Weight = InferSchemaType<typeof WeightSchema> & {
  _id: Types.ObjectId;
};
export const WeightModel = registerModel<Weight>("Weight", WeightSchema);
