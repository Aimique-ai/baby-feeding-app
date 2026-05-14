/**
 * Ad-hoc: add a single weight record without touching anything else.
 *
 * Usage:
 *   pnpm tsx --env-file=.env.local scripts/add-weight.ts <YYYY-MM-DD> <grams>
 */
import mongoose from "mongoose";
import { fromZonedTime } from "date-fns-tz";
import { dbConnect } from "../lib/mongodb";
import { BabyModel } from "../models/baby";
import { WeightModel } from "../models/weight";

const TZ = "Europe/Kyiv";

async function main() {
  const [, , dateISO, gramsStr] = process.argv;
  if (!dateISO || !gramsStr) {
    console.error("usage: add-weight.ts <YYYY-MM-DD> <grams>");
    process.exit(1);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
    console.error(`bad date: ${dateISO}`);
    process.exit(1);
  }
  const grams = Number(gramsStr);
  if (!Number.isFinite(grams) || grams <= 0) {
    console.error(`bad grams: ${gramsStr}`);
    process.exit(1);
  }

  await dbConnect();

  const baby = await BabyModel.findOne({ archivedAt: null }).sort({
    createdAt: 1,
  });
  if (!baby) {
    console.error("add-weight: no active baby found");
    process.exit(1);
  }
  const babyId = baby._id;

  const localMidnight = fromZonedTime(`${dateISO}T00:00:00`, TZ);
  const existing = await WeightModel.findOne({ babyId, date: localMidnight });
  if (existing) {
    console.log(
      `add-weight: ${dateISO} already has ${existing.weightGrams}g, updating to ${grams}g`,
    );
    existing.weightGrams = grams;
    await existing.save();
  } else {
    await WeightModel.create({ babyId, date: localMidnight, weightGrams: grams });
    console.log(`add-weight: created ${dateISO} = ${grams}g for "${baby.name}"`);
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
