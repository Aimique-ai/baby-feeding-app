/**
 * One-shot seeder: upsert system formula presets.
 *
 * Usage:
 *   pnpm seed:formulas
 *
 * Idempotent — uses `updateOne` with `$setOnInsert` keyed on `{ name, isSystem }`.
 * A repeated run neither duplicates the record nor overwrites manual edits.
 */
import mongoose from "mongoose";
import { dbConnect } from "../lib/mongodb";
import { FormulaModel } from "../models/formula";

async function main() {
  await dbConnect();

  const r = await FormulaModel.updateOne(
    { name: "Nan Optipro 1", isSystem: true },
    {
      $setOnInsert: {
        brand: "Nestlé",
        kcalPer100mlReady: 67,
        proteinGPer100kcal: 1.8,
        proteinGPer100mlReady: 1.2,
        stage: 1,
        kind: "standard",
        isSystem: true,
      },
    },
    { upsert: true },
  );

  if (r.upsertedCount > 0) {
    console.log("seed-formulas: created Nan Optipro 1");
  } else {
    console.log("seed-formulas: Nan Optipro 1 already present, no changes");
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
