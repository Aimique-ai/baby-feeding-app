/**
 * Dump every collection from the connected MongoDB database to JSON files.
 *
 * Usage: pnpm tsx --env-file=.env.local scripts/dump-all.ts [outDir]
 *   Default outDir: docs/db-dump
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import { dbConnect } from "../lib/mongodb";

async function main() {
  const outDir = path.resolve(process.argv[2] ?? "docs/db-dump");
  await mkdir(outDir, { recursive: true });

  await dbConnect();
  const db = mongoose.connection.db;
  if (!db) throw new Error("No active mongoose connection database");

  const collections = await db.listCollections().toArray();
  const summary: Array<{ name: string; count: number; file: string }> = [];

  for (const { name } of collections) {
    const docs = await db.collection(name).find({}).toArray();
    const file = path.join(outDir, `${name}.json`);
    await writeFile(file, JSON.stringify(docs, null, 2));
    summary.push({ name, count: docs.length, file });
    console.error(`  ${name}: ${docs.length} docs -> ${file}`);
  }

  await writeFile(
    path.join(outDir, "_summary.json"),
    JSON.stringify(
      {
        dumpedAt: new Date().toISOString(),
        database: db.databaseName,
        collections: summary,
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
