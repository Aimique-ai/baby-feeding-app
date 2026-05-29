/**
 * One-shot migration: backfill `currentFormulaId` on existing Baby docs.
 *
 * Usage:
 *   pnpm --filter @leon/api backfill:baby-formula
 *
 * Requires the system formula to be seeded first (`pnpm --filter @leon/api seed:formulas`).
 * Idempotent — only touches non-archived babies where `currentFormulaId`
 * is null or missing. Assigns the system "Nan Optipro 1" formula.
 */
import mongoose from "mongoose";
import { dbConnect } from "../db/mongo.js";
import { BabyModel } from "../models/baby.js";
import { FormulaModel } from "../models/formula.js";

async function main() {
  await dbConnect();

  const formula = await FormulaModel.findOne({
    name: "Nan Optipro 1",
    isSystem: true,
  });

  if (!formula) {
    throw new Error(
      'backfill-baby-formula: system formula "Nan Optipro 1" not found — ' +
        "run `pnpm --filter @leon/api seed:formulas` first",
    );
  }

  const r = await BabyModel.updateMany(
    {
      archivedAt: null,
      $or: [{ currentFormulaId: null }, { currentFormulaId: { $exists: false } }],
    },
    { $set: { currentFormulaId: formula._id } },
  );

  console.log(`backfill-baby-formula: updated ${r.modifiedCount} babies`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
