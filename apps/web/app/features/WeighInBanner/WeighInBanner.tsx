import { useState } from "react";
import { Button } from "~/components/ui/button";
import type { WeighInMetric } from "@leon/domain/who";

type TargetedWeighIn = {
  dateISO: string;
  metric: WeighInMetric;
};

type Props = {
  /** ISO date of "today" in local TZ; used as the localStorage dismissal key. */
  dateISO: string;
  daysSinceLastWeight: number;
  /** Nearest WHO interval boundary within ~3 days (or null). */
  targetedWeighIn?: TargetedWeighIn | null;
};

// Soft cadence for 1–6 months: about once a week; don't nudge more often.
const SOFT_CADENCE_DAYS = 7;

const METRIC_LABEL: Record<WeighInMetric, string> = {
  "early-velocity": "ранний темп набора",
  "monthly-velocity": "темп за месяц",
};

function fmtDate(dateISO: string): string {
  const [, m, d] = dateISO.split("-");
  return d && m ? `${d}.${m}` : dateISO;
}

export function WeighInBanner({
  dateISO,
  daysSinceLastWeight,
  targetedWeighIn,
}: Props) {
  const storageKey = `weigh-banner-dismissed:${dateISO}`;
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  // Targeted reminder takes priority: a weigh-in is needed for a specific metric.
  const message = targetedWeighIn
    ? `Взвесь ребёнка в ближайшие дни (к ~${fmtDate(targetedWeighIn.dateISO)}), чтобы рассчитать ${METRIC_LABEL[targetedWeighIn.metric]}.`
    : daysSinceLastWeight >= SOFT_CADENCE_DAYS
      ? `Полезно взвешивать примерно раз в неделю — последнее взвешивание ${daysSinceLastWeight} дн. назад.`
      : null;

  if (!message) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-between rounded-md border bg-accent/40 px-3 py-2 text-sm"
    >
      <span>{message}</span>
      <Button
        variant="ghost"
        size="sm"
        aria-label="Скрыть напоминание о взвешивании"
        onClick={() => {
          try {
            window.localStorage.setItem(storageKey, "1");
          } catch {
            // ignore storage errors
          }
          setDismissed(true);
        }}
      >
        Скрыть
      </Button>
    </div>
  );
}
