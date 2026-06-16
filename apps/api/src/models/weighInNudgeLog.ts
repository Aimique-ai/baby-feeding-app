import { Schema, Types, type InferSchemaType } from "mongoose";
import { registerModel } from "../db/registerModel.js";

// Durable idempotency log for weigh-in push nudges. The weigh-in sweep runs
// hourly, so this is the source of truth for "already nudged" — the unique
// compound index lets the sweep insert-before-send and skip on E11000, which
// survives restarts, overlapping ticks, and a baby reachable via several
// subscriptions. `dateISO` is the baby's LOCAL calendar day the nudge was for.
const WeighInNudgeLogSchema = new Schema(
  {
    babyId: {
      type: Schema.Types.ObjectId,
      ref: "Baby",
      required: true,
    },
    dateISO: { type: String, required: true },
    kind: {
      type: String,
      enum: ["primary", "catch-up"],
      required: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

WeighInNudgeLogSchema.index(
  { babyId: 1, dateISO: 1, kind: 1 },
  { unique: true },
);

// The sweep only ever reads the current local day (the dedupe key is that day),
// so a row is dead weight once its day has passed. TTL auto-prunes; 14 days is
// generous slack for tz spread and clock skew so the collection can't grow
// unbounded (one row per baby per weekly nudge otherwise lives forever).
WeighInNudgeLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 14 * 24 * 60 * 60 },
);

export type WeighInNudgeLog = InferSchemaType<typeof WeighInNudgeLogSchema> & {
  _id: Types.ObjectId;
};

export const WeighInNudgeLogModel = registerModel<WeighInNudgeLog>(
  "WeighInNudgeLog",
  WeighInNudgeLogSchema,
);
