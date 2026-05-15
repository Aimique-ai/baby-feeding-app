"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Muted } from "@/components/ui/typography";
import { fmtMl, roundMl } from "@/lib/format/ml";
import { fmtHm, fmtDateLong } from "@/lib/format/time";
import { babyKey, feedingsKey, weightsKey, medicationsKey } from "./feedingsKey";
import {
  deserializeBaby,
  deserializeFeeding,
  deserializeWeight,
  type SerializedFeeding,
  type SerializedMedication,
  type SerializedWeight,
} from "@/lib/api/serializedTypes";
import { computeTarget } from "@/lib/planning/target";
import { computeStartPlan } from "@/lib/planning/startPlan";
import { runPipeline } from "@/lib/planning/pipeline";
import {
  addDaysISO,
  dayOfLife,
  localDateISO,
  startOfLocalDay,
} from "@/lib/planning/dayBoundary";
import type { Slot } from "@/lib/planning/types";
import { WeighInBanner } from "./WeighInBanner";
import { getBrowserTz, tzHeaders } from "@/lib/time/browserTz";

type Mode = "live" | "historical";

type Props = {
  mode: Mode;
  dateISO: string;
  tz: string;
  babyId: string;
  /**
   * Last feeding *before* startOfLocalDay(dateISO, tz), used as anchor for
   * both the start plan and the pipeline's first tailBefore.
   */
  prevDayAnchor?: string | null;
  onAddFeeding?: (preset?: {
    time?: Date;
    volumeMl?: number;
  }) => void;
  onEditFeeding?: (feedingId: string) => void;
};

async function fetchFeedings(
  dateISO: string,
  tz: string,
): Promise<SerializedFeeding[]> {
  const r = await fetch(`/api/feedings?date=${dateISO}`, {
    cache: "no-store",
    headers: tzHeaders(tz),
  });
  if (!r.ok) throw new Error("feedings fetch failed");
  return r.json();
}

async function fetchWeights(): Promise<SerializedWeight[]> {
  const r = await fetch("/api/weights", { cache: "no-store" });
  if (!r.ok) throw new Error("weights fetch failed");
  // /api/weights returns desc; planning expects any order, but tests sort.
  return r.json();
}

async function fetchMedications(): Promise<SerializedMedication[]> {
  const r = await fetch("/api/medications", { cache: "no-store" });
  if (!r.ok) throw new Error("medications fetch failed");
  return r.json();
}

type TimelineItem =
  | {
      kind: "fact";
      id: string;
      time: Date;
      volumeMl: number | null;
      isTopUp: boolean;
      orphan: boolean;
      medicationId: string | null;
      medicationDoseDrops: number | null;
    }
  | {
      kind: "plan";
      id: string;
      time: Date;
      volumeMl: number;
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
        <Link href={`/history/${prevISO}`}>
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
          <Link href={nextHref}>
            <ChevronRight className="size-5" aria-hidden />
          </Link>
        </Button>
      )}
    </div>
  );
}

export function DayView({
  mode,
  dateISO,
  tz,
  babyId,
  prevDayAnchor,
  onAddFeeding,
  onEditFeeding,
}: Props) {
  const effectiveTz = getBrowserTz(tz);
  const [planOpen, setPlanOpen] = useState(false);

  const feedingsQ = useQuery({
    queryKey: feedingsKey(babyId, dateISO, effectiveTz),
    queryFn: () => fetchFeedings(dateISO, effectiveTz),
  });
  const babyQ = useQuery({
    queryKey: babyKey(babyId),
    queryFn: () => fetch("/api/baby", { cache: "no-store" }).then((r) => r.json()),
  });
  const weightsQ = useQuery({
    queryKey: weightsKey(babyId),
    queryFn: fetchWeights,
  });
  const medicationsQ = useQuery({
    queryKey: medicationsKey(babyId),
    queryFn: fetchMedications,
  });

  const derived = useMemo(() => {
    if (
      !feedingsQ.data ||
      !babyQ.data ||
      !weightsQ.data ||
      !medicationsQ.data
    )
      return null;
    const facts = feedingsQ.data.map(deserializeFeeding);
    const rawFeedingsById = new Map<string, SerializedFeeding>(
      feedingsQ.data.map((f) => [f._id, f]),
    );
    const medMap = new Map<string, { name: string }>(
      medicationsQ.data.map((m) => [m._id, { name: m.name }]),
    );
    const baby = deserializeBaby(babyQ.data);
    const weights = weightsQ.data.map(deserializeWeight);
    const target = computeTarget(dateISO, baby, weights, effectiveTz);
    const dayStart = startOfLocalDay(dateISO, effectiveTz);
    const anchor = prevDayAnchor ? new Date(prevDayAnchor) : null;

    const startPlan = computeStartPlan(
      dateISO,
      target,
      anchor
        ? [
            {
              _id: "anchor",
              startAt: anchor,
              endAt: null,
              volumeMl: null,
              isTopUp: false,
              parentFeedingId: null,
            },
          ]
        : [],
      effectiveTz,
    );

    const result = runPipeline({
      facts,
      target,
      startOfDay: dayStart,
      dateISO,
      tz: effectiveTz,
      prevDayAnchor: anchor,
      feedingsPerDay: baby.feedingsPerDay,
    });

    const factIds = new Set(facts.map((f) => f._id));
    const factsView: TimelineItem[] = facts.map((f) => {
      const raw = rawFeedingsById.get(f._id);
      return {
        kind: "fact",
        id: f._id,
        time: f.startAt,
        volumeMl: f.volumeMl,
        isTopUp: f.isTopUp,
        orphan:
          f.isTopUp &&
          f.parentFeedingId != null &&
          !factIds.has(f.parentFeedingId),
        medicationId: raw?.medicationId ?? null,
        medicationDoseDrops: raw?.medicationDoseDrops ?? null,
      };
    });
    const planView: TimelineItem[] = result.tail.map((s, i) => ({
      kind: "plan",
      id: `plan-${i}`,
      time: s.time,
      volumeMl: s.volumeMl,
    }));

    const timeline: TimelineItem[] = [...factsView, ...planView].sort(
      (a, b) => a.time.getTime() - b.time.getTime(),
    );

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

    return {
      target,
      consumed: result.consumed,
      tail: result.tail as Slot[],
      startPlan,
      timeline,
      dol,
      currentWeightGrams: currentWeight,
      daysSinceLastWeight,
      medMap,
    };
  }, [
    feedingsQ.data,
    babyQ.data,
    weightsQ.data,
    medicationsQ.data,
    dateISO,
    effectiveTz,
    prevDayAnchor,
  ]);

  if (!derived) {
    return <div className="p-4 text-sm text-muted-foreground">Загрузка…</div>;
  }

  const {
    target,
    consumed,
    startPlan,
    timeline,
    dol,
    currentWeightGrams,
    daysSinceLastWeight,
    medMap,
  } = derived;

  const progressPct = Math.min(
    100,
    Math.round((consumed / Math.max(1, target)) * 100),
  );

  const next = nextPlanned(timeline);
  const deficit = target - consumed;

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
          день {dol} · {currentWeightGrams} г
        </div>
        <div className="flex items-baseline gap-3">
          <div className="text-3xl font-semibold tabular-nums">
            {fmtMl(consumed)}
          </div>
          <div className="text-sm text-muted-foreground">
            из {fmtMl(target)}
          </div>
        </div>
        <Progress value={progressPct} aria-label={`Прогресс ${progressPct}%`} />

        {mode === "live" && next && (
          <Muted>
            Следующее: {fmtHm(next.time, effectiveTz)} · {fmtMl(next.volumeMl)}
          </Muted>
        )}
        {mode === "historical" && (
          <p
            className={
              "text-sm " +
              (deficit > 0
                ? "text-destructive"
                : deficit < 0
                  ? "text-emerald-600"
                  : "text-muted-foreground")
            }
          >
            {deficit > 0
              ? `Недостача: ${fmtMl(deficit)}`
              : deficit < 0
                ? `Перекорм: ${fmtMl(-deficit)}`
                : "Цель достигнута"}
          </p>
        )}
      </header>

      <Collapsible open={planOpen} onOpenChange={setPlanOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1">
            <ChevronDown
              className={
                "size-4 transition-transform " + (planOpen ? "rotate-180" : "")
              }
              aria-hidden
            />
            Идеальный план дня
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <ul className="grid grid-cols-2 gap-1 text-sm tabular-nums">
            {startPlan.map((s, i) => (
              <li
                key={i}
                className="flex justify-between rounded border px-2 py-1"
              >
                <span>{fmtHm(s.time, effectiveTz)}</span>
                <span className="text-muted-foreground">
                  {fmtMl(s.volumeMl)}
                </span>
              </li>
            ))}
          </ul>
        </CollapsibleContent>
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
            <button
              type="button"
              onClick={() => {
                if (it.kind === "fact") {
                  onEditFeeding?.(it.id);
                } else {
                  onAddFeeding?.({
                    time: it.time,
                    volumeMl: roundMl(it.volumeMl),
                  });
                }
              }}
              className={
                "flex w-full min-h-[44px] items-start justify-between rounded-md border px-3 py-2 text-left " +
                (it.kind === "fact"
                  ? "border-foreground/20 bg-background"
                  : "border-dashed text-muted-foreground")
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
                        : fmtMl(it.volumeMl)
                    }`
              }
            >
              <span className="tabular-nums">{fmtHm(it.time, effectiveTz)}</span>
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-sm tabular-nums">
                  {it.kind === "fact"
                    ? it.volumeMl != null
                      ? fmtMl(it.volumeMl)
                      : "по режиму"
                    : fmtMl(it.volumeMl)}
                  {it.kind === "fact" && it.isTopUp && !it.orphan
                    ? " · докорм"
                    : ""}
                </span>
                {it.kind === "fact" && it.medicationId && (
                  <span className="text-xs text-muted-foreground">
                    {medMap.get(it.medicationId)?.name ?? "(архив)"} ·{" "}
                    {it.medicationDoseDrops} капель
                  </span>
                )}
              </div>
            </button>
          </li>
        ))}
        {timeline.length === 0 && (
          <li className="text-sm text-muted-foreground">Записей нет.</li>
        )}
      </ul>
    </div>
  );
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
