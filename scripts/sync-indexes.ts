import mongoose from "mongoose";
import { dbConnect } from "../lib/mongodb";
import { MedicationModel } from "../models/medication";
import { BabyModel } from "../models/baby";
import { FeedingModel } from "../models/feeding";
import { WeightModel } from "../models/weight";

async function syncOne(label: string, Model: mongoose.Model<unknown>) {
  const before = await Model.collection.indexes();
  console.log(`\n[${label}] before:`);
  for (const i of before)
    console.log("  -", i.name, JSON.stringify(i.key), i.unique ? "(unique)" : "");

  const old = before.find((i) => i.name === "name_1");
  if (label === "medications" && old) {
    console.log("dropping old name_1...");
    await Model.collection.dropIndex("name_1");
  }

  await Model.syncIndexes();

  const after = await Model.collection.indexes();
  console.log(`[${label}] after:`);
  for (const i of after)
    console.log("  -", i.name, JSON.stringify(i.key), i.unique ? "(unique)" : "");
}

async function main() {
  await dbConnect();
  await syncOne("babies", BabyModel as mongoose.Model<unknown>);
  await syncOne("feedings", FeedingModel as mongoose.Model<unknown>);
  await syncOne("weights", WeightModel as mongoose.Model<unknown>);
  await syncOne("medications", MedicationModel as mongoose.Model<unknown>);
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
