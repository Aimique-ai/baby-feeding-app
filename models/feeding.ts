import { Schema, Types, type InferSchemaType } from "mongoose";
import { registerModel } from "@/lib/db/registerModel";

const FeedingSchema = new Schema(
  {
    babyId: {
      type: Schema.Types.ObjectId,
      ref: "Baby",
      required: true,
    },
    startAt: { type: Date, required: true },
    endAt: { type: Date, default: null },
    volumeMl: { type: Number, default: null },
    isTopUp: { type: Boolean, required: true, default: false },
    parentFeedingId: {
      type: Schema.Types.ObjectId,
      ref: "Feeding",
      default: null,
    },
    medicationId: {
      type: Schema.Types.ObjectId,
      ref: "Medication",
      default: null,
    },
    medicationDoseDrops: { type: Number, default: null },
  },
  { timestamps: true },
);

FeedingSchema.index({ babyId: 1, startAt: 1 });
FeedingSchema.index({ parentFeedingId: 1 });

export type Feeding = InferSchemaType<typeof FeedingSchema> & {
  _id: Types.ObjectId;
};
export const FeedingModel = registerModel<Feeding>("Feeding", FeedingSchema);
