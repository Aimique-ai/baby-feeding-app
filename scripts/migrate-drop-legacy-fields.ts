/**
 * One-shot migration: drop orphaned legacy fields from the database.
 *
 *   babies.feedingsPerDay   — поле удалено из схемы (feed-plan-rewrite Этап B)
 *   feedings.parentFeedingId — поле + индекс удалены из схемы (Этап B)
 *
 * Usage:
 *   pnpm migrate:drop-legacy-fields
 *
 * ВАЖНО — миграция идёт через RAW collection API (BabyModel.collection /
 * FeedingModel.collection), а НЕ через модель. К этому моменту поля уже удалены
 * из схем; Mongoose в strict-режиме вырезал бы `$unset` неизвестного схеме пути
 * при касте — updateMany через модель стал бы тихим no-op. Нативный драйвер
 * `.collection` схему не применяет, поэтому `$unset` доходит до Mongo.
 *
 * Идемпотентно: `$unset` несуществующего поля — no-op. Повторный прогон
 * безопасен и даст modifiedCount = 0.
 *
 * Индекс `parentFeedingId_1` снимается отдельно — `scripts/sync-indexes.ts`.
 */
import mongoose from "mongoose";
import { dbConnect } from "../lib/mongodb";
import { BabyModel } from "../models/baby";
import { FeedingModel } from "../models/feeding";

async function main() {
  await dbConnect();

  const babyRes = await BabyModel.collection.updateMany(
    {},
    { $unset: { feedingsPerDay: "" } },
  );
  const feedingRes = await FeedingModel.collection.updateMany(
    {},
    { $unset: { parentFeedingId: "" } },
  );

  console.log("dropped feedingsPerDay:", babyRes.modifiedCount);
  console.log("dropped parentFeedingId:", feedingRes.modifiedCount);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
