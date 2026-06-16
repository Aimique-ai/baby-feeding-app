import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
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

type TimelineItem = {
  kind: "fact";
  id: string;
  time: Date;
  volumeMl: number | null;
  isTopUp: boolean;
  medicationId: string | null;
  medicationDoseDrops: number | null;
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
    const timeline: TimelineItem[] = [...factsView].sort(
      (a, b) => a.time.getTime() - b.time.getTime(),
    );

    // The single next-feeding window — a PREDICTION of when the baby may be
    // hungry again, not a deadline. Live mode only; shown as-is even when past.
    const nextFeeding = mode === "live" ? plan.nextFeeding : null;

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
    const ageDays = dol;
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
      nextFeeding,
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
    return <DayViewSkeleton mode={mode} dateISO={dateISO} tz={effectiveTz} />;
  }

  const {
    guidance,
    consumed,
    timeline,
    nextFeeding,
    ageLabel,
    currentWeightGrams,
    daysSinceLastWeight,
    targetedWeighIn,
    medMap,
    formulaName,
    oversizedSingleFeed,
  } = derived;

  const neonatalRange =
    derived.kind === "neonatal" ? derived.perFeedRange : null;

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

      {mode === "live" && nextFeeding && (
        <button
          type="button"
          onClick={() => {
            if (neonatalRange) {
              // Neonatal: no prescriptive prefill — parent enters it themselves.
              onAddFeeding?.({ time: nextFeeding.time });
            } else {
              onAddFeeding?.({
                time: nextFeeding.time,
                volumeMl: roundMl(nextFeeding.volumeMl),
              });
            }
          }}
          className="group flex w-full items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-left transition-colors hover:bg-primary/10 dark:bg-primary/10 dark:hover:bg-primary/15"
          aria-label={`Следующее кормление, окно ${fmtHm(nextFeeding.windowStart, effectiveTz)}–${fmtHm(nextFeeding.windowEnd, effectiveTz)}`}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Clock className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Следующее кормление
            </span>
            <span className="block text-lg font-semibold leading-tight tabular-nums">
              ~{fmtHm(nextFeeding.windowStart, effectiveTz)}–
              {fmtHm(nextFeeding.windowEnd, effectiveTz)}
            </span>
          </span>
          <ArrowUpRight
            className="size-5 shrink-0 text-primary transition-transform group-hover:translate-x-px group-hover:-translate-y-px"
            aria-hidden
          />
        </button>
      )}

      <ul role="list" className="space-y-1">
        {timeline.map((it) => (
          <li key={`fact-${it.id}`} role="listitem">
            <Button
              variant="outline"
              onClick={() => onEditFeeding?.(it.id)}
              className="h-auto min-h-[44px] w-full items-start justify-between border-solid border-foreground/20 bg-background px-3 py-2 text-left font-normal dark:bg-background"
              aria-label={
                it.medicationId
                  ? `${fmtHm(it.time, effectiveTz)} ${
                      it.volumeMl != null ? fmtMl(it.volumeMl) : ""
                    } ${medMap.get(it.medicationId)?.name ?? "(архив)"} ${it.medicationDoseDrops} капель`
                  : `${fmtHm(it.time, effectiveTz)} ${
                      it.volumeMl != null ? fmtMl(it.volumeMl) : ""
                    }`
              }
            >
              <span className="tabular-nums">
                {fmtHm(it.time, effectiveTz)}
              </span>
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-sm tabular-nums">
                  {it.volumeMl != null ? fmtMl(it.volumeMl) : "по режиму"}
                  {it.isTopUp ? " · докорм" : ""}
                </span>
                {it.medicationId && (
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

function DayViewSkeleton({
  mode,
  dateISO,
  tz,
}: {
  mode: Mode;
  dateISO: string;
  tz: string;
}) {
  return (
    <div className="mx-auto max-w-screen-sm px-4 py-4 space-y-6">
      <header className="space-y-2">
        <DayNav dateISO={dateISO} tz={tz} />
        <div className="flex justify-center">
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-5 w-40" />
        </div>
      </header>

      {mode === "live" && (
        <Card className="gap-2 border-primary/30 py-3 shadow-none">
          <CardHeader className="px-4">
            <Skeleton className="h-4 w-28" />
          </CardHeader>
          <CardContent className="space-y-3 px-4">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-4 w-full max-w-xs" />
            <Skeleton className="h-5 w-44" />
          </CardContent>
        </Card>
      )}

      {mode === "live" && (
        <div className="flex w-full items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 dark:bg-primary/10">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-6 w-28" />
          </div>
        </div>
      )}

      <ul role="list" className="space-y-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i} role="listitem">
            <div className="flex min-h-[44px] items-center justify-between rounded-md border border-foreground/20 px-3 py-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-16" />
            </div>
          </li>
        ))}
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
