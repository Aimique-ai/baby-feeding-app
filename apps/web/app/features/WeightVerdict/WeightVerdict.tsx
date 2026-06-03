import { CircleCheck, CircleAlert, TriangleAlert } from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import type { WeightsAnalytics } from "@leon/domain/who/types";
import {
  isStatusReason,
  REASON_VIEW,
  STATUS_VIEW,
  type StatusKind,
} from "./copyMap";
import { velocityPeriodLabel, velocityRecency } from "./velocityPeriod";
import type { MonthlyVelocity, PercentileTrend } from "@leon/domain/who/types";

const KIND_STYLE: Record<
  StatusKind,
  { border: string; icon: typeof CircleCheck; iconClass: string }
> = {
  green: {
    border: "border-l-4 border-l-emerald-500",
    icon: CircleCheck,
    iconClass: "text-emerald-500",
  },
  yellow: {
    border: "border-l-4 border-l-amber-500",
    icon: CircleAlert,
    iconClass: "text-amber-500",
  },
  red: {
    border: "border-l-4 border-l-destructive",
    icon: TriangleAlert,
    iconClass: "text-destructive",
  },
};

type Props = {
  analytics: WeightsAnalytics;
  todayISO: string;
  onAddWeighIn: (prefillDateISO: string) => void;
};

export function WeightVerdict({ analytics, todayISO, onAddWeighIn }: Props) {
  const { verdict } = analytics;

  if (!verdict) {
    // Verdict is null: distinguish the reason from analytics itself.
    const reason =
      analytics.points.length < 2
        ? "Добавь ещё одно взвешивание, чтобы оценить динамику роста."
        : "Не хватает данных рождения для оценки роста.";
    return (
      <Card className="border-l-4 border-l-muted">
        <CardContent className="py-4 text-sm text-muted-foreground">
          {reason}
        </CardContent>
      </Card>
    );
  }

  const view = STATUS_VIEW[verdict.status];
  const style = KIND_STYLE[view.kind];
  const Icon = style.icon;

  const nextWeighIn =
    analytics.monthlyVelocity?.nextWeighInDateISO ??
    analytics.earlyVelocity?.nextWeighInDateISO ??
    null;
  const showCta =
    (verdict.boundaryState === "velocity-unavailable" ||
      verdict.boundaryState === "adaptation-loss-only") &&
    nextWeighIn !== null;

  // Show text/recommendations ONLY for status (red-flag) signals. Non-source
  // observations (velocity, deficit, corridor warn, fast-gain) aren't a call to
  // action, so the card doesn't explain them.
  const statusReasons = verdict.reasons.filter((r) => isStatusReason(r.code));

  return (
    <Card className={style.border}>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-start gap-2">
          <Icon className={`mt-0.5 size-5 shrink-0 ${style.iconClass}`} />
          <div className="text-base font-medium">{view.title}</div>
        </div>

        <ul className="space-y-2">
          {statusReasons.map((r, i) => {
            const rv = REASON_VIEW[r.code];
            if (!rv) return null;
            return (
              <li key={`${r.code}-${i}`} className="text-sm">
                <div>{rv.text}</div>
                {rv.affordance ? (
                  <div className="text-xs text-muted-foreground">
                    {rv.affordance}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

        {analytics.monthlyVelocity ? (
          <VelocityDetail
            v={analytics.monthlyVelocity}
            trend={analytics.percentileTrend}
            birthDateISO={analytics.birthDate}
            todayISO={todayISO}
          />
        ) : null}

        {showCta && nextWeighIn ? (
          <div className="rounded-md border bg-accent/30 px-3 py-2">
            <div className="text-sm">
              Чтобы рассчитать темп роста, нужен вес на ~{fmtDate(nextWeighIn)}.
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => onAddWeighIn(nextWeighIn)}
            >
              Добавить взвешивание
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function fmtDate(dateISO: string): string {
  const [y, m, d] = dateISO.split("-");
  if (!y || !m || !d) return dateISO;
  return `${d}.${m}`;
}

function fmtZ(z: number): string {
  return `${z > 0 ? "+" : ""}${z.toFixed(1)}`;
}

function fmtPercentile(p: number): string {
  if (p >= 1 && p <= 99) return `P${Math.round(p)}`;
  return p < 1 ? "P<1" : "P>99";
}

// Velocity detail, inlined into the verdict block. Any judgement lives in the
// status/reasons above; this shows only the numbers.
function VelocityDetail({
  v,
  trend,
  birthDateISO,
  todayISO,
}: {
  v: MonthlyVelocity;
  trend: PercentileTrend | null;
  birthDateISO: string;
  todayISO: string;
}) {
  return (
    <div className="border-t pt-3">
      <div className="text-xs text-muted-foreground">
        Темп за {velocityPeriodLabel(v, birthDateISO)} ·{" "}
        {velocityRecency(v, todayISO)}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">
        {v.deltaGrams > 0 ? "+" : ""}
        {v.deltaGrams} г{" "}
        <span className="text-sm font-normal text-muted-foreground">
          ({v.fromWeightGrams} → {v.toWeightGrams})
        </span>
      </div>
      <div className="text-xs text-muted-foreground tabular-nums">
        темп {fmtPercentile(v.percentile)} (z {fmtZ(v.z)})
        {trend
          ? ` · перцентиль ${fmtPercentile(trend.fromPercentile)} → ${fmtPercentile(trend.toPercentile)}`
          : ""}
      </div>
    </div>
  );
}
