import type { Job } from "bullmq";
import { differenceInCalendarDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { addDaysISO, localDateISO } from "@leon/domain/planning/dayBoundary";
import {
  nextTargetWeighIn,
  weeklyWeighInStatus,
  weeksLabelRu,
  type WeighInMetric,
} from "@leon/domain/who";
import { dbConnect } from "../db/mongo.js";
import { BabyModel } from "../models/baby.js";
import { WeightModel } from "../models/weight.js";
import { PushSubscriptionModel } from "../models/pushSubscription.js";
import { WeighInNudgeLogModel } from "../models/weighInNudgeLog.js";
import { sendPushToBaby } from "../push/webpush.js";
import {
  WEIGH_IN_MIN_HOUR_LOCAL,
  WEIGH_IN_TARGET_WINDOW_DAYS,
} from "./constants.js";

const METRIC_LABEL: Record<WeighInMetric, string> = {
  "early-velocity": "раннего темпа набора",
  "monthly-velocity": "темпа набора за месяц",
};

type BabyDoc = {
  _id: { toString(): string };
  name: string;
  birthDate: Date;
};

// One nudge per baby per local day per kind. "primary" covers same-day weekly
// and targeted WHO nudges; "catch-up" is the next-day reminder for a missed
// weekly boundary.
type NudgeLogKind = "primary" | "catch-up";

type Nudge = {
  logKind: NudgeLogKind;
  title: string;
  body: string;
};

// Decide the weigh-in nudge for one baby at the subscription's local "now".
// Priority: a baby weighed today is already satisfied (handled by the caller);
// otherwise targeted WHO boundary > weekly primary > weekly catch-up.
function decideWeighInNudge(
  baby: BabyDoc,
  weighingDays: Set<string>,
  todayISO: string,
  tz: string,
  now: Date,
): Nudge | null {
  const next = nextTargetWeighIn({
    birthDate: baby.birthDate,
    tz,
    weighingDates: [],
    now,
  });
  if (next) {
    const boundaryLocal = toZonedTime(`${next.dateISO}T00:00:00`, tz);
    const nowLocal = toZonedTime(now, tz);
    const daysUntil = differenceInCalendarDays(boundaryLocal, nowLocal);
    if (daysUntil >= 0 && daysUntil <= WEIGH_IN_TARGET_WINDOW_DAYS) {
      return {
        logKind: "primary",
        title: `${baby.name}: пора взвесить`,
        body: `Нужно для расчёта ${METRIC_LABEL[next.metric]} — взвесь в ближайшие дни`,
      };
    }
  }

  const weekly = weeklyWeighInStatus(baby.birthDate, now, tz);
  if (weekly?.kind === "primary") {
    return {
      logKind: "primary",
      title: `${baby.name}: ровно ${weeksLabelRu(weekly.weeks)}`,
      body: "Хорошее время взвесить",
    };
  }
  if (weekly?.kind === "catch-up") {
    // Only nudge if the boundary day (yesterday) also had no weighing — a weight
    // on the boundary itself means they didn't actually miss it.
    const yesterdayISO = addDaysISO(todayISO, -1);
    if (!weighingDays.has(yesterdayISO)) {
      return {
        logKind: "catch-up",
        title: `${baby.name}: пропущено вчерашнее взвешивание`,
        body: "Вчера была недельная отметка — взвесьте сегодня",
      };
    }
  }

  return null;
}

// `nextTargetWeighIn` is given an empty weighing list above so its ±3d coverage
// check never self-suppresses; we gate on the explicit weighed-today check
// instead, so all branches share one suppression rule.
function isWeighedToday(weighingDays: Set<string>, todayISO: string): boolean {
  return weighingDays.has(todayISO);
}

// Hourly sweep over push subscriptions. For each (subscription, baby) it fires a
// weigh-in nudge once per local day, gated on local hour >= WEIGH_IN_MIN_HOUR_LOCAL.
// Idempotency is the WeighInNudgeLog unique index (insert-before-send), not the
// in-memory set — the set is only a cheap pre-filter to avoid redundant work
// when a baby is reachable through several subscriptions in the same tz/day.
export async function processWeighInSweep(job: Job): Promise<void> {
  const now = new Date();
  await dbConnect();

  const subs = await PushSubscriptionModel.find({})
    .select("babyIds tz")
    .lean();

  const babyCache = new Map<string, BabyDoc | null>();
  const weighingDaysCache = new Map<string, Set<string>>();
  const handled = new Set<string>();
  let sentCount = 0;

  for (const sub of subs) {
    const tz = sub.tz;
    if (!tz) continue;
    const hourLocal = toZonedTime(now, tz).getHours();
    if (hourLocal < WEIGH_IN_MIN_HOUR_LOCAL) continue;

    const todayISO = localDateISO(now, tz);
    for (const babyIdRaw of sub.babyIds) {
      const babyId = babyIdRaw.toString();
      const preKey = `${babyId}:${tz}:${todayISO}`;
      if (handled.has(preKey)) continue;
      handled.add(preKey);

      let baby = babyCache.get(babyId);
      if (baby === undefined) {
        const doc = (await BabyModel.findById(babyId)
          .select("name birthDate archivedAt")
          .lean()) as (BabyDoc & { archivedAt?: Date | null }) | null;
        baby = doc && doc.archivedAt == null ? doc : null;
        babyCache.set(babyId, baby);
      }
      if (!baby) continue;

      const weighCacheKey = `${babyId}:${tz}`;
      let weighingDays = weighingDaysCache.get(weighCacheKey);
      if (weighingDays === undefined) {
        const docs = await WeightModel.find({ babyId }).select("date").lean();
        weighingDays = new Set(docs.map((d) => localDateISO(d.date, tz)));
        weighingDaysCache.set(weighCacheKey, weighingDays);
      }

      if (isWeighedToday(weighingDays, todayISO)) continue;

      const nudge = decideWeighInNudge(baby, weighingDays, todayISO, tz, now);
      if (!nudge) continue;

      // Insert-before-send: the unique index is the source of truth. A duplicate
      // key means this baby+day+kind was already nudged (another tick / sub).
      try {
        await WeighInNudgeLogModel.create({
          babyId,
          dateISO: todayISO,
          kind: nudge.logKind,
        });
      } catch (err) {
        if ((err as { code?: number }).code === 11000) continue;
        throw err;
      }

      await sendPushToBaby(babyId, {
        title: nudge.title,
        body: nudge.body,
        babyId,
        url: `/?baby=${babyId}`,
      });
      sentCount += 1;
    }
  }

  console.log(
    `[reminders] weigh-in sweep done ${JSON.stringify({ jobId: job.id, subs: subs.length, sent: sentCount })}`,
  );
}
