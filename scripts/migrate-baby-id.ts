/**
 * One-shot migration: stamp `babyId` onto existing Feeding/Weight/Medication.
 *
 * Usage:
 *   pnpm migrate:baby-id
 *
 * Idempotent — only touches documents where `babyId` is missing.
 *
 * Requires exactly one non-archived baby in the database. Run BEFORE
 * deploying code that requires `babyId` on writes.
 *
 * NOTE about old indexes:
 *   The old global unique index on `medications.name` (partial on deletedAt)
 *   needs to be dropped manually in MongoDB shell:
 *     db.medications.dropIndex("name_1")
 *   The new per-baby compound index `{ babyId: 1, name: 1 }` will be created
 *   automatically on next model load.
 */
import mongoose from "mongoose";
import { dbConnect } from "../lib/mongodb";
import { BabyModel } from "../models/baby";
import { FeedingModel } from "../models/feeding";
import { WeightModel } from "../models/weight";
import { MedicationModel } from "../models/medication";

async function main() {
  await dbConnect();

  const babies = await BabyModel.find({ archivedAt: null }).lean();
  if (babies.length === 0) {
    console.error("migrate: no active baby found — aborting");
    process.exit(1);
  }
  if (babies.length > 1) {
    console.error(
      `migrate: found ${babies.length} active babies — ambiguous, aborting`,
    );
    process.exit(1);
  }

  const babyId = babies[0]._id;
  console.log(`migrate: stamping babyId=${babyId} ("${babies[0].name}")`);

  const [feedings, weights, medications] = await Promise.all([
    FeedingModel.updateMany(
      { babyId: { $exists: false } },
      { $set: { babyId } },
    ),
    WeightModel.updateMany(
      { babyId: { $exists: false } },
      { $set: { babyId } },
    ),
    MedicationModel.updateMany(
      { babyId: { $exists: false } },
      { $set: { babyId } },
    ),
  ]);

  console.log(`migrate: feedings updated=${feedings.modifiedCount}`);
  console.log(`migrate: weights updated=${weights.modifiedCount}`);
  console.log(`migrate: medications updated=${medications.modifiedCount}`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
