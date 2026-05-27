/**
 * Read-only DB walk: asserts every live babies.currentFormulaId matches
 * /^[a-fA-F0-9]{24}$/ — the regex narrowing introduced by @leon/schemas/baby.
 *
 * Usage: pnpm tsx --env-file=.env.local scripts/smoke/objectid-equivalence.ts
 */
import mongoose from "mongoose";
import { dbConnect } from "../../lib/mongodb";

const HEX_24 = /^[a-fA-F0-9]{24}$/;

async function main() {
  await dbConnect();
  const db = mongoose.connection.db;
  if (!db) throw new Error("No active mongoose connection database");

  const rows = await db
    .collection("babies")
    .find({}, { projection: { _id: 1, currentFormulaId: 1 } })
    .toArray();

  let checked = 0;
  let nulls = 0;
  const failures: { _id: string; value: unknown }[] = [];

  for (const r of rows) {
    const v = r.currentFormulaId;
    if (v == null) {
      nulls += 1;
      continue;
    }
    const s = typeof v === "string" ? v : v?.toString?.();
    checked += 1;
    if (typeof s !== "string" || !HEX_24.test(s)) {
      failures.push({ _id: r._id.toString(), value: v });
    }
  }

  console.log(
    `babies: ${rows.length} | currentFormulaId set: ${checked} | null: ${nulls} | regex failures: ${failures.length}`,
  );
  if (failures.length > 0) {
    console.error("Non-hex values:", failures);
    process.exitCode = 1;
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
