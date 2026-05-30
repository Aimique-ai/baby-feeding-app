import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Muted } from "@/components/ui/typography";
import { fmtMl, roundMl } from "@/lib/format/ml";
import { fmtHm, fmtDateLong } from "@/lib/format/time";
import {
  babyKey,
  feedingsKey,
  weightsKey,
  medicationsKey,
} from "./feedingsKey";
import {
  deserializeBaby,
  deserializeFeeding,
  deserializeWeight,
} from "@leon/schemas/plan";
import type { BabyWithFormula } from "@leon/schemas/baby";
import type { Feeding } from "@leon/schemas/feeding";
import {
  computeFeedingGuidance,
  DEFAULT_FORMULA_DENSITY,
} from "@leon/domain/planning/target";
import type { FormulaDensity, TargetFlag } from "@leon/domain/planning/types";

// AAP sanity-check по объёму — второе число рядом с FAO. Легко скрыть.
const SHOW_AAP = true;

// Single-feed sanity check (§7.5): >14д ⇒ фактический МАКС объём одного
// кормления > 40 мл/кг → info (отлов ошибок ввода). Зоны 0–7д/8–14д — в движке.
const NEONATAL_MAX_AGE_DAYS_UI = 14;
const SINGLE_FEED_ML_PER_KG_CAP = 40;
import { runPipeline } from "@leon/domain/planning/pipeline";
import {
  addDaysISO,
  dayOfLife,
  localDateISO,
  startOfLocalDay,
} from "@leon/domain/planning/dayBoundary";
import { WeighInBanner } from "./WeighInBanner";
import { getBrowserTz } from "@/lib/time/browserTz";
import { listFeedingsByDate } from "@/lib/api/feedings";
import { listWeights } from "@/lib/api/weights";
import { listMedications } from "@/lib/api/medications";
import { getActiveBaby, patchBaby } from "@/lib/api/babies";

type Mode = "live" | "historical";

type Props = {
  mode: Mode;
  dateISO: string;
  tz: string;
  babyId: string;
  prevMainCandidates: Feeding[];
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
      // Neonatal: диапазон "30–60" вместо предписывающего числа; при наличии
      // префилл формы не задаётся (родитель вводит реальный объём).
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

  if (consumed < low) {
    return {
      className: "text-warning",
      text: `Ниже дневного ориентира на ${fmtMl(low - consumed)}`,
    };
  }

  if (consumed > high) {
    return {
      className: "text-warning",
      text: `Выше дневного ориентира на ${fmtMl(consumed - high)}`,
    };
  }

  return {
    className: "text-muted-foreground",
    text: "В дневном ориентире",
  };
}

export function DayView({
  mode,
  dateISO,
  tz,
  babyId,
  prevMainCandidates,
  onAddFeeding,
  onEditFeeding,
}: Props) {
  const effectiveTz = getBrowserTz(tz);
  const [planOpen, setPlanOpen] = useState(false);

  const feedingsQ = useQuery({
    queryKey: feedingsKey(babyId, dateISO, effectiveTz),
    queryFn: () => listFeedingsByDate(dateISO),
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

  const qc = useQueryClient();
  const updatePreferredFeedCount = useMutation({
    mutationFn: (value: number) =>
      patchBaby(babyId, { preferredFeedCount: value }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: babyKey(babyId) });
    },
  });

  const derived = useMemo(() => {
    if (!feedingsQ.data || !babyQ.data || !weightsQ.data || !medicationsQ.data)
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
    const formulaDensity: FormulaDensity = serializedFormula
      ? {
          kcalPer100ml: serializedFormula.kcalPer100mlReady,
          proteinGPer100kcal: serializedFormula.proteinGPer100kcal,
        }
      : DEFAULT_FORMULA_DENSITY;
    const storedPreferredFeedCount = babyQ.data.preferredFeedCount ?? null;
    const guidance = computeFeedingGuidance(
      dateISO,
      baby,
      weights,
      effectiveTz,
      formulaDensity,
      storedPreferredFeedCount,
    );
    const dayStart = startOfLocalDay(dateISO, effectiveTz);
    const prevMainCandidates_d = prevMainCandidates.map(deserializeFeeding);

    const result =
      guidance.mode === "energy"
        ? runPipeline({
            mode: "energy",
            facts,
            target: guidance.dailyMl,
            dateISO,
            tz: effectiveTz,
            range: guidance.feedCountRange,
            birthDate: baby.birthDate,
            prevMainCandidates: prevMainCandidates_d,
          })
        : runPipeline({
            mode: "neonatal",
            facts,
            perFeedRange: guidance.perFeedMlRange,
            dateISO,
            tz: effectiveTz,
            range: guidance.feedCountRange,
            birthDate: baby.birthDate,
            prevMainCandidates: prevMainCandidates_d,
          });

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
    // Неонатальный слот несёт диапазон 30–60, а не предписывающее число.
    const neonatalRange: [number, number] | undefined =
      guidance.mode === "neonatal" ? guidance.perFeedMlRange : undefined;

    // Плановые слоты — только для текущего дня. У прошедшего дня "будущих"
    // кормлений нет: история показывает только факты.
    const planView: TimelineItem[] =
      mode === "live"
        ? result.plan.slots.map((s, i) => ({
            kind: "plan",
            id: `plan-${i}`,
            time: s.time,
            volumeMl: s.volumeMl,
            volumeRange: neonatalRange,
          }))
        : [];

    const timeline: TimelineItem[] = [...factsView, ...planView].sort(
      (a, b) => a.time.getTime() - b.time.getTime(),
    );

    if (mode === "live" && result.plan.tomorrowSlot) {
      timeline.push({
        kind: "plan",
        id: "plan-tomorrow",
        time: result.plan.tomorrowSlot.time,
        volumeMl: result.plan.tomorrowSlot.volumeMl,
        volumeRange: neonatalRange,
        isTomorrow: true,
      });
    }

    const dol = dayOfLife(baby.birthDate, dayStart, effectiveTz);
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

    const showPreferredFeedCountBanner =
      mode === "live" &&
      storedPreferredFeedCount !== null &&
      storedPreferredFeedCount !== guidance.feedCount;

    // Single-feed sanity check зоны >14д (§7.5): фактический МАКС объём одного
    // не-докорм кормления против 40 мл/кг. Слой кормлений — здесь есть и факты,
    // и вес. Цель — отлов ошибок ввода ("400 мл в одной бутылочке").
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
      consumed: result.consumed,
      timeline,
      dol,
      currentWeightGrams: currentWeight,
      daysSinceLastWeight,
      medMap,
      formulaName: serializedFormula?.name ?? null,
      storedPreferredFeedCount,
      showPreferredFeedCountBanner,
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
    const progressPct = Math.min(
      100,
      Math.round((result.consumed / Math.max(1, target)) * 100),
    );
    const historicalStatus = historicalTargetStatus(
      result.consumed,
      guidance.dailyMlRange,
    );
    return {
      kind: "energy" as const,
      guidance,
      target,
      progressPct,
      historicalStatus,
      ...shared,
    };
  }, [
    feedingsQ.data,
    babyQ.data,
    weightsQ.data,
    medicationsQ.data,
    dateISO,
    effectiveTz,
    mode,
    prevMainCandidates,
  ]);

  if (!derived) {
    return <div className="p-4 text-sm text-muted-foreground">Загрузка…</div>;
  }

  const {
    guidance,
    consumed,
    timeline,
    dol,
    currentWeightGrams,
    daysSinceLastWeight,
    medMap,
    formulaName,
    storedPreferredFeedCount,
    showPreferredFeedCountBanner,
    oversizedSingleFeed,
  } = derived;

  const feedCountOptions: number[] = [];
  for (
    let n = guidance.feedCountRange[0];
    n <= guidance.feedCountRange[1];
    n++
  ) {
    feedCountOptions.push(n);
  }
  const isDegenerateRange =
    guidance.feedCountRange[0] === guidance.feedCountRange[1];

  const next = nextPlanned(timeline);

  return (
    <div className="mx-auto max-w-screen-sm px-4 py-4 space-y-6">
      {mode === "live" && (
        <WeighInBanner
          dateISO={dateISO}
          daysSinceLastWeight={daysSinceLastWeight}
        />
      )}
      <header className="space-y-2">
        <DayNav dateISO={dateISO} tz={effectiveTz} />
        <div className="text-center text-xs text-muted-foreground">
          день {dol} · {currentWeightGrams} г ·{" "}
          {formulaName ?? "смесь не выбрана"}
        </div>

        {derived.kind === "energy" ? (
          <>
            <div className="flex items-baseline gap-3">
              <div className="text-3xl font-semibold tabular-nums">
                {fmtMl(consumed)}
              </div>
              <div className="text-sm text-muted-foreground">
                из {fmtMl(derived.target)}
              </div>
              {SHOW_AAP && (
                // AAP sanity-check — easy to hide.
                <div className="text-xs text-muted-foreground tabular-nums">
                  проверка по объёму (AAP): {fmtMl(derived.guidance.aapMl)}
                </div>
              )}
            </div>
            <Progress
              value={derived.progressPct}
              aria-label={`Прогресс ${derived.progressPct}%`}
            />
            {mode === "live" && next && (
              <Muted>
                Следующее: {fmtHm(next.time, effectiveTz)} ·{" "}
                {fmtMl(next.volumeMl)}
              </Muted>
            )}
            {mode === "historical" && (
              <p className={"text-sm " + derived.historicalStatus.className}>
                {derived.historicalStatus.text}
              </p>
            )}
          </>
        ) : (
          <>
            <div className="flex items-baseline gap-3">
              <div className="text-3xl font-semibold tabular-nums">
                {fmtMl(consumed)}
              </div>
              <div className="text-sm text-muted-foreground tabular-nums">
                съедено · {derived.guidance.feedCount} кормлений
              </div>
            </div>
            <Muted>
              В первые две недели нет суточного ориентира — ребёнок берёт
              сколько нужно.
            </Muted>
          </>
        )}
      </header>

      {showPreferredFeedCountBanner && (
        <Card className="gap-2 border-warning bg-warning/10 py-3 text-sm text-warning shadow-none">
          <CardContent className="space-y-2 px-3">
            <p>
              Выбранное число кормлений ({storedPreferredFeedCount}) больше не
              входит в возрастной диапазон [{guidance.feedCountRange[0]}–
              {guidance.feedCountRange[1]}]. Сейчас применяется{" "}
              {guidance.feedCount}.
            </p>
            {isDegenerateRange && (
              <Button
                size="sm"
                variant="outline"
                disabled={updatePreferredFeedCount.isPending}
                onClick={() =>
                  updatePreferredFeedCount.mutate(guidance.feedCountRange[0])
                }
              >
                Применить {guidance.feedCountRange[0]}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="gap-2 py-3 shadow-none">
        <CardHeader className="px-3">
          <CardTitle className="text-sm font-semibold">Рекомендация</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 px-3">
          {derived.kind === "energy" ? (
            <div className="flex items-baseline gap-3 tabular-nums">
              <span className="text-lg font-semibold">
                {derived.guidance.mlPerFeedRange[0]}–
                {fmtMl(derived.guidance.mlPerFeedRange[1])}
              </span>
              <span className="text-sm text-muted-foreground">
                за {guidance.feedCountRange[0]}–{guidance.feedCountRange[1]}{" "}
                кормлений
              </span>
            </div>
          ) : (
            <div className="flex items-baseline gap-3 tabular-nums">
              <span className="text-lg font-semibold">
                {derived.perFeedRange[0]}–{fmtMl(derived.perFeedRange[1])}
              </span>
              <span className="text-sm text-muted-foreground">
                за {derived.feedCountRange[0]}–{derived.feedCountRange[1]}{" "}
                кормлений
              </span>
            </div>
          )}
          <Muted>
            Ребёнок берёт сколько нужно — кормление можно завершать по сигналам
            насыщения.
          </Muted>
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
              {fmtMl(oversizedSingleFeed.perFeedMl)}) — возможно, ошибка ввода,
              проверьте.
            </p>
          )}
        </CardContent>
      </Card>

      <Collapsible open={planOpen} onOpenChange={setPlanOpen}>
        <div className="flex items-center justify-between gap-2">
          {derived.kind === "energy" && derived.guidance.protein ? (
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1">
                <ChevronDown
                  className={
                    "size-4 transition-transform " +
                    (planOpen ? "rotate-180" : "")
                  }
                  aria-hidden
                />
                Белок
              </Button>
            </CollapsibleTrigger>
          ) : (
            <span />
          )}
          {mode === "live" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 tabular-nums"
                  disabled={
                    isDegenerateRange || updatePreferredFeedCount.isPending
                  }
                >
                  План на старт дня: {guidance.feedCount}
                  <ChevronDown className="size-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {feedCountOptions.map((n) => (
                  <DropdownMenuItem
                    key={n}
                    className="tabular-nums"
                    onSelect={() => updatePreferredFeedCount.mutate(n)}
                  >
                    {n}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {derived.kind === "energy" && derived.guidance.protein && (
          <CollapsibleContent className="mt-2">
            <p className="text-xs text-muted-foreground tabular-nums">
              {derived.guidance.protein.gPerKgDay.toFixed(1)} г/кг в сутки —
              контрольный показатель, не цель по объёму.
            </p>
          </CollapsibleContent>
        )}
      </Collapsible>

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
                  // Neonatal: без предписывающего префилла — родитель вводит сам.
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
                  : `${fmtHm(it.time, effectiveTz)} ${
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
                {fmtHm(it.time, effectiveTz)}
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
  time: Date;
  volumeMl: number;
} | null {
  const now = Date.now();
  for (const it of items) {
    if (it.time.getTime() <= now) continue;
    if (it.kind === "plan") {
      return { time: it.time, volumeMl: it.volumeMl };
    }
  }
  return null;
}
