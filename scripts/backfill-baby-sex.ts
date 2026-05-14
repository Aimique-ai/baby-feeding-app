/**
 * One-shot migration: backfill `sex` on existing Baby docs.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/backfill-baby-sex.ts
 *
 * Idempotent — only touches documents where `sex` is missing. Defaults to "male".
 */
import mongoose from "mongoose";
import { dbConnect } from "../lib/mongodb";
import { BabyModel } from "../models/baby";

async function main() {
  await dbConnect();

  const r = await BabyModel.updateMany(
    { sex: { $exists: false } },
    { $set: { sex: "male" } },
  );

  console.log(`backfill-baby-sex: updated ${r.modifiedCount} babies`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
