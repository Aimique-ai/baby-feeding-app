import { Schema, Types, type InferSchemaType } from "mongoose";
import { registerModel } from "../db/registerModel.js";

// Web Push subscription, device-centric. `endpoint` is the browser's push
// endpoint URL (unique per subscription). `babyIds` is the M2M link — one
// device may receive reminders for several babies; indexed for delivery lookup.
const PushSubscriptionSchema = new Schema(
  {
    endpoint: { type: String, required: true, unique: true },
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
    babyIds: [{ type: Schema.Types.ObjectId, ref: "Baby" }],
  },
  { timestamps: true },
);

PushSubscriptionSchema.index({ babyIds: 1 });

export type PushSubscription = InferSchemaType<typeof PushSubscriptionSchema> & {
  _id: Types.ObjectId;
};

export const PushSubscriptionModel = registerModel<PushSubscription>(
  "PushSubscription",
  PushSubscriptionSchema,
);
