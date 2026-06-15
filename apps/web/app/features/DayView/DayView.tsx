import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Muted } from "~/components/ui/typography";
import { fmtMl, roundMl } from "~/lib/format/ml";
import { fmtAge } from "~/lib/format/age";
import { fmtHm, fmtDateLong } from "~/lib/format/time";
import { FeedingSignalsSheet } from "~/features/FeedingSignalsSheet";
import {
  babyKey,
  feedingsKey,
  feedingsPlanKey,
  weightsKey,
  medicationsKey,
} from "~/lib/queryKeys";
import {
  deserializeBaby,
  deserializeFeeding,
  deserializeWeight,
} from "@leon/schemas/plan";
import type { BabyWithFormula } from "@leon/schemas/baby";
import type { Feeding } from "@leon/schemas/feeding";
import type { TargetFlag } from "@leon/domain/planning/types";

// Single-feed sanity check (§7.5): >14d ⇒ actual MAX volume of one feed
// > 40 ml/kg → info (catches input errors). Zones 0–7d/8–14d live in the engine.
const NEONATAL_MAX_AGE_DAYS_UI = 14;
const SINGLE_FEED_ML_PER_KG_CAP = 40;
import {
  addDaysISO,
  dayOfLife,
  localDateISO,
  startOfLocalDay,
} from "@leon/domain/planning/dayBoundary";
import { nextTargetWeighIn } from "@leon/domain/who";
import { WeighInBanner } from "~/features/WeighInBanner";
import { getBrowserTz } from "~/lib/time/browserTz";
import { fetchFeedingPlan, listFeedingsByDate } from "~/lib/api/feedings";
import { listWeights } from "~/lib/api/weights";
import { listMedications } from "~/lib/api/medications";
import { getActiveBaby } from "~/lib/api/babies";

type Mode = "live" | "historical";

type Props = {
  mode: Mode;
  dateISO: string;
  tz: string;
  babyId: string;
  onAddFeeding?: (preset?: { time?: Date; volumeMl?: number }) => void;
  onEditFeeding?: (feedingId: string) => void;
};

type TimelineItem =
  | {
      kind: "fact";
      id: string;
      time: Date;
      volumeMl: number | null;
      isTopUp: boolean;
      medicationId: string | null;
      medicationDoseDrops: number | null;
    }
  | {
      kind: "plan";
      id: string;
      time: Date;
      volumeMl: number;
      // The feeding window [start, end] around the center `time`. The UI shows
      // the window, not the single minute — a plan slot is an expectation, not
      // a prescribed moment.
      windowStart: Date;
      windowEnd: Date;
      // Neonatal: a "30–60" range instead of a prescriptive number; when
      // present the form prefill is omitted (parent enters the real volume).
      volumeRange?: [number, number];
      isTomorrow?: boolean;
    };

function DayNav({ dateISO, tz }: { dateISO: string; tz: string }) {
  const todayISO = localDateISO(new Date(), tz);
  const isToday = dateISO === todayISO;
  const prevISO = addDaysISO(dateISO, -1);
  const nextISO = addDaysISO(dateISO, 1);
  const nextHref = nextISO === todayISO ? "/" : `/history/${nextISO}`;
  const label = fmtDateLong(startOfLocalDay(dateISO, tz), tz);

  return (
    <div className="flex items-center justify-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground"
        asChild
        aria-label="Предыдущий день"
      >
        <Link to={`/history/${prevISO}`}>
          <ChevronLeft className="size-5" aria-hidden />
        </Link>
      </Button>
      <h1 className="min-w-[10rem] text-center text-base font-semibold tabular-nums">
        {label}
      </h1>
      {isToday ? (
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground"
          disabled
          aria-label="Следующий день"
        >
          <ChevronRight className="size-5" aria-hidden />
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground"
          asChild
          aria-label="Следующий день"
        >
          <Link to={nextHref}>
            <ChevronRight className="size-5" aria-hidden />
          </Link>
        </Button>
      )}
    </div>
  );
}

function historicalTargetStatus(
  consumed: number,
  dailyMlRange: [number, number],
): { className: string; text: string } {
  const [low, high] = dailyMlRange;

  if (consumed < low || consumed > high) {
    return {
      className: "text-muted-foreground",
      text: `Обычно у детей этого веса около ${fmtMl(low)}–${fmtMl(high)}`,
    };
  }

  return {
    className: "text-muted-foreground",
    text: "В рамках обычного для этого веса",
  };
}

export function DayView({
  mode,
  dateISO,
  tz,
  babyId,
  onAddFeeding,
  onEditFeeding,
}: Props) {
  const effectiveTz = getBrowserTz(tz);
  const [signalsOpen, setSignalsOpen] = useState(false);

  const feedingsQ = useQuery({
    queryKey: feedingsKey(babyId, dateISO, effectiveTz),
    queryFn: () => listFeedingsByDate(dateISO),
  });
  const planQ = useQuery({
    queryKey: feedingsPlanKey(babyId, dateISO, effectiveTz),
    queryFn: () => fetchFeedingPlan(dateISO),
  });
  const babyQ = useQuery<BabyWithFormula>({
    queryKey: babyKey(babyId),
    queryFn: getActiveBaby,
  });
  const weightsQ = useQuery({
    queryKey: weightsKey(babyId),
    queryFn: listWeights,
  });
  const medicationsQ = useQuery({
    queryKey: medicationsKey(babyId),
    queryFn: listMedications,
  });

  const derived = useMemo(() => {
    if (
      !feedingsQ.data ||
      !babyQ.data ||
      !weightsQ.data ||
      !medicationsQ.data ||
      !planQ.data
    )
      return null;
    const facts = feedingsQ.data.map(deserializeFeeding);
    const rawFeedingsById = new Map<string, Feeding>(
      feedingsQ.data.map((f) => [f._id, f]),
    );
    const medMap = new Map<string, { name: string }>(
      medicationsQ.data.map((m) => [m._id, { name: m.name }]),
    );
    const baby = deserializeBaby(babyQ.data);
    const serializedFormula = babyQ.data.formula;
    const weights = weightsQ.data.map(deserializeWeight);
    const plan = planQ.data;
    const guidance = plan.guidance;
    const consumed = plan.consumed;
    const dayStart = startOfLocalDay(dateISO, effectiveTz);

    const factsView: TimelineItem[] = facts.map((f) => {
      const raw = rawFeedingsById.get(f._id);
      return {
        kind: "fact",
        id: f._id,
        time: f.startAt,
        volumeMl: f.volumeMl,
        isTopUp: f.isTopUp,
        medicationId: raw?.medicationId ?? null,
        medicationDoseDrops: raw?.medicationDoseDrops ?? null,
      };
    });
    // A neonatal slot carries the 30–60 range, not a prescriptive number.
    const neonatalRange: [number, number] | undefined =
      guidance.mode === "neonatal" ? guidance.perFeedMlRange : undefined;

    // Plan slots only for the current day. A past day has no "future" feeds:
    // history shows facts only.
    const planView: TimelineItem[] =
      mode === "live"
        ? plan.slots.map((s, i) => ({
            kind: "plan",
            id: `plan-${i}`,
            time: s.time,
            volumeMl: s.volumeMl,
            windowStart: s.windowStart,
            windowEnd: s.windowEnd,
            volumeRange: neonatalRange,
          }))
        : [];

    const timeline: TimelineItem[] = [...factsView, ...planView].sort(
      (a, b) => a.time.getTime() - b.time.getTime(),
    );

    if (mode === "live" && plan.tomorrowSlot) {
      timeline.push({
        kind: "plan",
        id: "plan-tomorrow",
        time: plan.tomorrowSlot.time,
        volumeMl: plan.tomorrowSlot.volumeMl,
        windowStart: plan.tomorrowSlot.windowStart,
        windowEnd: plan.tomorrowSlot.windowEnd,
        volumeRange: neonatalRange,
        isTomorrow: true,
      });
    }

    const dol = dayOfLife(baby.birthDate, dayStart, effectiveTz);
    const ageLabel = fmtAge(baby.birthDate, dayStart, effectiveTz);
    const eligibleWeights = weights.filter(
      (w) => w.date.getTime() <= dayStart.getTime(),
    );
    const latestWeight = eligibleWeights.length
      ? eligibleWeights.reduce((a, w) =>
          w.date.getTime() > a.date.getTime() ? w : a,
        )
      : null;
    const currentWeight = latestWeight
      ? latestWeight.weightGrams
      : baby.birthWeightGrams;
    const daysSinceLastWeight = latestWeight
      ? Math.floor(
          (dayStart.getTime() - latestWeight.date.getTime()) /
            (24 * 3600 * 1000),
        )
      : 0;

    // Targeted reminder: ~2–3 days before the nearest uncovered WHO interval
    // boundary, name the metric that this weigh-in would unlock.
    const nextWeighIn = nextTargetWeighIn({
      birthDate: baby.birthDate,
      tz: effectiveTz,
      weighingDates: weights.map((w) => w.date),
      now: dayStart,
    });
    const upcomingWindow = [0, 1, 2, 3].map((d) => addDaysISO(dateISO, d));
    const targetedWeighIn =
      nextWeighIn !== null && upcomingWindow.includes(nextWeighIn.dateISO)
        ? { dateISO: nextWeighIn.dateISO, metric: nextWeighIn.metric }
        : null;

    // Single-feed sanity check, >14d zone (§7.5): actual MAX volume of one
    // non-top-up feed against 40 ml/kg. The feedings layer has both facts and
    // weight here. Goal: catch input errors ("400 ml in a single bottle").
    const ageDays = dol - 1;
    const weightKg = currentWeight / 1000;
    const maxSingleFeedMl = facts.reduce(
      (mx, f) =>
        !f.isTopUp && f.volumeMl != null && f.volumeMl > mx ? f.volumeMl : mx,
      0,
    );
    const oversizedSingleFeed =
      ageDays > NEONATAL_MAX_AGE_DAYS_UI &&
      weightKg > 0 &&
      maxSingleFeedMl > SINGLE_FEED_ML_PER_KG_CAP * weightKg
        ? { perFeedMl: maxSingleFeedMl, weightKg }
        : null;

    const shared = {
      consumed,
      timeline,
      dol,
      ageLabel,
      currentWeightGrams: currentWeight,
      daysSinceLastWeight,
      targetedWeighIn,
      medMap,
      formulaName: serializedFormula?.name ?? null,
      oversizedSingleFeed,
    };

    if (guidance.mode === "neonatal") {
      return {
        kind: "neonatal" as const,
        guidance,
        perFeedRange: guidance.perFeedMlRange,
        feedCountRange: guidance.feedCountRange,
        ...shared,
      };
    }

    const target = guidance.dailyMl;
    const historicalStatus = historicalTargetStatus(
      consumed,
      guidance.dailyMlRange,
    );
    return {
      kind: "energy" as const,
      guidance,
      target,
      historicalStatus,
      ...shared,
    };
  }, [
    feedingsQ.data,
    babyQ.data,
    weightsQ.data,
    medicationsQ.data,
    planQ.data,
    dateISO,
    effectiveTz,
    mode,
  ]);

  if (!derived) {
    return <div className="p-4 text-sm text-muted-foreground">Загрузка…</div>;
  }

  const {
    guidance,
    consumed,
    timeline,
    ageLabel,
    currentWeightGrams,
    daysSinceLastWeight,
    targetedWeighIn,
    medMap,
    formulaName,
    oversizedSingleFeed,
  } = derived;

  const next = nextPlanned(timeline);

  return (
    <div className="mx-auto max-w-screen-sm px-4 py-4 space-y-6">
      {mode === "live" && (
        <WeighInBanner
          dateISO={dateISO}
          daysSinceLastWeight={daysSinceLastWeight}
          targetedWeighIn={targetedWeighIn}
        />
      )}
      <header className="space-y-2">
        <DayNav dateISO={dateISO} tz={effectiveTz} />
        <div className="text-center text-xs text-muted-foreground tabular-nums">
          {ageLabel} · {currentWeightGrams} г ·{" "}
          {formulaName ?? "смесь не выбрана"}
        </div>

        {derived.kind === "energy" ? (
          <>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 tabular-nums">
              <div className="text-3xl font-semibold">{fmtMl(consumed)}</div>
              <div className="text-sm text-muted-foreground">
                съедено · ориентир ≈{fmtMl(derived.target)}
              </div>
            </div>
            {mode === "live" && next && (
              <Muted>
                Окно кормления: ~{fmtHm(next.windowStart, effectiveTz)}–
                {fmtHm(next.windowEnd, effectiveTz)}
              </Muted>
            )}
            {mode === "historical" && (
              <p className={"text-sm " + derived.historicalStatus.className}>
                {derived.historicalStatus.text}
              </p>
            )}
          </>
        ) : (
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 tabular-nums">
            <div className="text-3xl font-semibold">{fmtMl(consumed)}</div>
            <div className="text-sm text-muted-foreground">съедено сегодня</div>
          </div>
        )}
      </header>

      {mode === "live" && (
        <Card className="gap-2 border-primary/30 py-3 shadow-none">
          <CardHeader className="px-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Сколько давать
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-4">
            {(() => {
              const perFeed =
                derived.kind === "energy"
                  ? derived.guidance.mlPerFeedRange
                  : derived.perFeedRange;
              const feeds =
                derived.kind === "energy"
                  ? guidance.feedCountRange
                  : derived.feedCountRange;
              return (
                <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 tabular-nums">
                  <span className="text-4xl font-bold leading-none tracking-tight">
                    {perFeed[0]}–{perFeed[1]}
                  </span>
                  <span className="text-base font-medium text-muted-foreground">
                    мл
                  </span>
                  <span className="px-1 text-lg text-muted-foreground">×</span>
                  <span className="text-xl font-semibold leading-none">
                    {feeds[0]}–{feeds[1]}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">
                    раз/день
                  </span>
                </div>
              );
            })()}
            <Muted>
              {derived.kind === "neonatal"
                ? "В первые две недели нет суточного ориентира — ребёнок берёт сколько нужно."
                : "По требованию — кормление можно завершать по сигналам ребёнка."}
            </Muted>
            <button
              type="button"
              onClick={() => setSignalsOpen(true)}
              className="group inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline hover:underline-offset-2"
            >
              Сигналы голода и сытости
              <ArrowUpRight
                className="size-4 transition-transform group-hover:translate-x-px group-hover:-translate-y-px"
                aria-hidden
              />
            </button>
            {derived.guidance.flags.map((f) => (
              <p
                key={f.code}
                className={
                  f.severity === "warning"
                    ? "text-xs text-warning"
                    : "text-xs text-info"
                }
              >
                {flagText(f)}
              </p>
            ))}
            {oversizedSingleFeed && (
              <p className="text-xs text-info">
                Одно кормление необычно велико для веса (
                {fmtMl(oversizedSingleFeed.perFeedMl)}) — возможно, ошибка
                ввода, проверьте.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <FeedingSignalsSheet open={signalsOpen} onOpenChange={setSignalsOpen} />

      <ul role="list" className="space-y-1">
        {timeline.map((it) => (
          <li
            key={
              it.kind === "fact"
                ? `fact-${it.id}`
                : `plan-${it.time.toISOString()}`
            }
            role="listitem"
          >
            <Button
              variant="outline"
              onClick={() => {
                if (it.kind === "fact") {
                  onEditFeeding?.(it.id);
                } else if (it.volumeRange) {
                  // Neonatal: no prescriptive prefill — parent enters it themselves.
                  onAddFeeding?.({ time: it.time });
                } else {
                  onAddFeeding?.({
                    time: it.time,
                    volumeMl: roundMl(it.volumeMl),
                  });
                }
              }}
              className={
                "h-auto min-h-[44px] w-full items-start justify-between px-3 py-2 text-left font-normal " +
                (it.kind === "fact"
                  ? "border-solid border-foreground/20 bg-background dark:bg-background"
                  : it.isTomorrow
                    ? "border-solid border-primary bg-primary/5 text-foreground dark:bg-primary/10"
                    : "border-dashed border-muted-foreground/40 bg-transparent text-muted-foreground dark:bg-transparent")
              }
              aria-label={
                it.kind === "fact" && it.medicationId
                  ? `${fmtHm(it.time, effectiveTz)} ${
                      it.volumeMl != null ? fmtMl(it.volumeMl) : ""
                    } ${medMap.get(it.medicationId)?.name ?? "(архив)"} ${it.medicationDoseDrops} капель`
                  : `${
                      it.kind === "plan"
                        ? `${fmtHm(it.windowStart, effectiveTz)}–${fmtHm(it.windowEnd, effectiveTz)}`
                        : fmtHm(it.time, effectiveTz)
                    } ${
                      it.kind === "fact"
                        ? it.volumeMl != null
                          ? fmtMl(it.volumeMl)
                          : ""
                        : it.volumeRange
                          ? `${it.volumeRange[0]}–${it.volumeRange[1]} мл`
                          : fmtMl(it.volumeMl)
                    }`
              }
            >
              <span className="tabular-nums">
                {it.kind === "plan"
                  ? `~${fmtHm(it.windowStart, effectiveTz)}–${fmtHm(it.windowEnd, effectiveTz)}`
                  : fmtHm(it.time, effectiveTz)}
              </span>
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-sm tabular-nums">
                  {it.kind === "fact"
                    ? it.volumeMl != null
                      ? fmtMl(it.volumeMl)
                      : "по режиму"
                    : it.volumeRange
                      ? `${it.volumeRange[0]}–${it.volumeRange[1]} мл`
                      : fmtMl(it.volumeMl)}
                  {it.kind === "fact" && it.isTopUp ? " · докорм" : ""}
                </span>
                {it.kind === "fact" && it.medicationId && (
                  <span className="text-xs text-muted-foreground">
                    {medMap.get(it.medicationId)?.name ?? "(архив)"} ·{" "}
                    {it.medicationDoseDrops} капель
                  </span>
                )}
              </div>
            </Button>
          </li>
        ))}
        {timeline.length === 0 && (
          <li className="text-sm text-muted-foreground">Записей нет.</li>
        )}
      </ul>
    </div>
  );
}

function flagText(f: TargetFlag): string {
  switch (f.code) {
    case "ml_per_kg_high":
      return "Суточный объём выше практического коридора.";
    case "ml_per_kg_low":
      return "Суточный объём ниже практического коридора.";
    case "aap_soft_cap_exceeded":
      return `Суточный объём превышает практический потолок AAP (${fmtMl(f.valueMl)} > 960 мл).`;
    case "density_out_of_codex_range":
      return `Энергоплотность смеси вне диапазона Codex 60–70 ккал/100 мл (${f.kcalPer100ml}).`;
    case "large_single_feed_early_newborn":
      return `Крупное разовое кормление для первых дней (${fmtMl(f.perFeedMl)}) — кормите чаще, меньшим объёмом.`;
    case "single_feed_unusually_large_for_weight":
      return `Одно кормление необычно велико для веса (${fmtMl(f.perFeedMl)}) — возможно, ошибка ввода, проверьте.`;
  }
}

function nextPlanned(items: TimelineItem[]): {
  windowStart: Date;
  windowEnd: Date;
  volumeMl: number;
} | null {
  const now = Date.now();
  for (const it of items) {
    if (it.time.getTime() <= now) continue;
    if (it.kind === "plan") {
      return {
        windowStart: it.windowStart,
        windowEnd: it.windowEnd,
        volumeMl: it.volumeMl,
      };
    }
  }
  return null;
}
