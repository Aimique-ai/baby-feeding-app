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

  const presets = [
    {
      name: "Nan Optipro 1",
      brand: "Nestlé",
      kcalPer100mlReady: 67,
      proteinGPer100kcal: 1.8,
      proteinGPer100mlReady: 1.2,
      stage: 1,
      kind: "standard" as const,
      isSystem: true,
    },
    {
      name: "Nan Supreme Pro 1",
      brand: "Nestlé",
      kcalPer100mlReady: 67,
      proteinGPer100kcal: 1.9,
      proteinGPer100mlReady: 1.27,
      stage: 1,
      kind: "standard" as const,
      isSystem: true,
    },
  ];

  for (const preset of presets) {
    const r = await FormulaModel.updateOne(
      { name: preset.name, isSystem: true },
      { $setOnInsert: preset },
      { upsert: true },
    );
    if (r.upsertedCount > 0) {
      console.log(`seed-formulas: created ${preset.name}`);
    } else {
      console.log(`seed-formulas: ${preset.name} already present, no changes`);
    }
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
