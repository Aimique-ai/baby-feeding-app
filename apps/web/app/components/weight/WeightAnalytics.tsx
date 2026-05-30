import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { weightsAnalyticsKey } from "@/components/day-view/feedingsKey";
import { getBrowserTz } from "@/lib/time/browserTz";
import { getWeightsAnalytics } from "@/lib/api/weights";
import type {
  AnalyticsPoint,
  AnalyticsVelocity,
  WeightsAnalytics,
} from "@leon/domain/who/types";

const chartConfig = {
  weightGrams: {
    label: "Вес, г",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const percentileChartConfig = {
  percentile: {
    label: "Перцентиль",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

function InfoHint({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Подсказка"
          className="size-auto p-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
        >
          <Info className="size-3" />
        </Button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{text}</TooltipContent>
    </Tooltip>
  );
}

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

function fmtPercentile(p: number): string {
  if (p >= 1 && p <= 99) return `P${Math.round(p)}`;
  if (p < 1) return `P<1`;
  return `P>99`;
}

function fmtZ(z: number): string {
  const sign = z > 0 ? "+" : "";
  return `${sign}${z.toFixed(1)}`;
}

function fmtSigned(n: number | null, unit = "г"): string {
  if (n === null) return "—";
  const r = Math.round(n);
  const sign = r > 0 ? "+" : "";
  return `${sign}${r} ${unit}`;
}

function wfaBadge(z: number): { label: string; variant: BadgeVariant } {
  if (z >= -2 && z <= 2) return { label: "Норма", variant: "default" };
  if (z < -2 && z >= -3) return { label: "Низкий вес", variant: "secondary" };
  if (z < -3) return { label: "Дефицит веса", variant: "destructive" };
  if (z > 2 && z <= 3) return { label: "Выше среднего", variant: "secondary" };
  return { label: "Избыток веса", variant: "destructive" };
}

function earlyLabel(cls: NonNullable<AnalyticsVelocity["earlyClass"]>): string {
  if (cls === "p50+") return "P50+";
  if (cls === "p25-50") return "P25–50";
  if (cls === "p10-25") return "P10–25";
  if (cls === "p5-10") return "P5–10";
  return "<P5";
}

function earlyVariant(
  cls: NonNullable<AnalyticsVelocity["earlyClass"]>,
): BadgeVariant {
  if (cls === "p50+" || cls === "p25-50") return "default";
  if (cls === "p10-25" || cls === "p5-10") return "secondary";
  return "destructive";
}

export function WeightAnalytics({
  babyId,
  tz,
}: {
  babyId: string;
  tz: string;
}) {
  const effectiveTz = getBrowserTz(tz);
  const q = useQuery({
    queryKey: weightsAnalyticsKey(babyId, effectiveTz),
    queryFn: getWeightsAnalytics,
  });

  const analytics = q.data;

  const chartData = useMemo(() => {
    if (!analytics) return [];
    return analytics.points.map((p) => ({
      date: formatInTimeZone(new Date(p.date), effectiveTz, "dd.MM"),
      weightGrams: p.weightGrams,
    }));
  }, [analytics, effectiveTz]);

  if (q.isLoading || !analytics) {
    return (
      <section className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-28" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="py-6">
            <Skeleton className="h-[220px] w-full" />
          </CardContent>
        </Card>
      </section>
    );
  }

  if (analytics.points.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Добавь первое взвешивание, чтобы увидеть аналитику.
        </CardContent>
      </Card>
    );
  }

  const latest = analytics.points[analytics.points.length - 1];
  const prev =
    analytics.points.length >= 2
      ? analytics.points[analytics.points.length - 2]
      : null;
  const deltaFromPrev = prev ? latest.weightGrams - prev.weightGrams : null;
  const latestWfaBadge = wfaBadge(latest.zWeightForAge);
  const inAdaptation = analytics.ageDaysNow < 14;
  const showMonthlyVelocity = analytics.monthlyVelocity !== null;

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground min-h-[2.5rem] flex items-center gap-1">
              Текущий вес
              <InfoHint text="Вес из последнего взвешивания. Под цифрой — разница в граммах с предыдущим замером." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {latest.weightGrams} г
            </div>
            <div className="text-xs text-muted-foreground tabular-nums">
              {deltaFromPrev !== null
                ? `${fmtSigned(deltaFromPrev)} от прошлого взвешивания`
                : "первое взвешивание"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground min-h-[2.5rem] flex items-center gap-1">
              По стандарту ВОЗ
              <InfoHint text="Перцентиль — место ребёнка среди здоровых сверстников по данным ВОЗ. P50 — медиана. P3–P97 — норма. Например, P40 значит: 40% детей того же возраста и пола весят меньше." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {fmtPercentile(latest.percentile)}
            </div>
            <div className="text-xs text-muted-foreground tabular-nums">
              z = {fmtZ(latest.zWeightForAge)} · возраст {latest.ageDays} дн
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground min-h-[2.5rem] flex items-center gap-1">
              Статус
              <InfoHint text="Классификация по z-score ВОЗ. Норма: −2 ≤ z ≤ +2 (это диапазон P3–P97). Низкий/избыточный вес — за пределами −2/+2." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={latestWfaBadge.variant}>
              {latestWfaBadge.label}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {inAdaptation ? (
        <AdaptationCard
          latest={latest}
          birthWeight={analytics.birthWeightGrams}
          earlyVelocity={analytics.earlyVelocity}
        />
      ) : null}

      {showMonthlyVelocity && analytics.monthlyVelocity ? (
        <MonthlyVelocityCard
          v={analytics.monthlyVelocity}
          trend={analytics.percentileTrend}
        />
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            По взвешиваниям ({analytics.points.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата</TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1 justify-end">
                    Возраст
                    <InfoHint text="Полных дней с момента рождения." />
                  </span>
                </TableHead>
                <TableHead className="text-right">Вес</TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1 justify-end">
                    Прошло
                    <InfoHint text="Сколько дней прошло с предыдущего взвешивания." />
                  </span>
                </TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1 justify-end">
                    Δ с прошлого
                    <InfoHint text="Разница в граммах между этим и предыдущим взвешиванием." />
                  </span>
                </TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1 justify-end">
                    г/сут
                    <InfoHint text="Средний прирост за сутки в этом интервале: «Δ с прошлого» делим на «Прошло»." />
                  </span>
                </TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1 justify-end">
                    Перцентиль
                    <InfoHint text="Место ребёнка среди здоровых сверстников по ВОЗ на момент взвешивания. P50 — медиана, P3–P97 — норма." />
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analytics.points
                .slice()
                .reverse()
                .map((p: AnalyticsPoint) => {
                  return (
                    <TableRow key={p._id}>
                      <TableCell className="tabular-nums">
                        {formatInTimeZone(
                          new Date(p.date),
                          effectiveTz,
                          "dd.MM",
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {p.ageDays} дн
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.weightGrams}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {p.daysSincePrev !== null
                          ? `${p.daysSincePrev} дн`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtSigned(p.deltaSincePrev)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtSigned(p.gramsPerDay)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtPercentile(p.percentile)}
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-1">
            Динамика веса
            <InfoHint text="Линия фактических взвешиваний во времени." />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[220px] w-full">
            <LineChart data={chartData} margin={{ left: 4, right: 12, top: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={48}
                domain={["dataMin - 100", "dataMax + 100"]}
                tickFormatter={(v) => `${v}`}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                type="monotone"
                dataKey="weightGrams"
                stroke="var(--color-weightGrams)"
                strokeWidth={2}
                dot
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-1">
            Динамика перцентиля
            <InfoHint text="Позиция ребёнка в популяции по ВОЗ во времени. Идеально — ровная линия (растёт по своей кривой). Падает — отстаёт от сверстников, растёт — обгоняет. P3–P97 — диапазон нормы, P50 — медиана." />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={percentileChartConfig}
            className="h-[200px] w-full"
          >
            <LineChart
              data={analytics.points.map((p) => ({
                date: formatInTimeZone(new Date(p.date), effectiveTz, "dd.MM"),
                percentile: Math.round(p.percentile),
              }))}
              margin={{ left: 4, right: 12, top: 8 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={36}
                domain={[0, 100]}
                ticks={[3, 50, 97]}
                tickFormatter={(v) => `P${v}`}
              />
              <ChartTooltip
                content={<ChartTooltipContent />}
                formatter={(v) => `P${v}`}
              />
              <ReferenceLine
                y={50}
                stroke="var(--muted-foreground)"
                strokeOpacity={0.4}
                strokeDasharray="4 4"
              />
              <ReferenceLine
                y={3}
                stroke="var(--destructive)"
                strokeOpacity={0.4}
              />
              <ReferenceLine
                y={97}
                stroke="var(--destructive)"
                strokeOpacity={0.4}
              />
              <Line
                type="monotone"
                dataKey="percentile"
                stroke="var(--color-percentile)"
                strokeWidth={2}
                dot
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </section>
  );
}

function AdaptationCard({
  latest,
  birthWeight,
  earlyVelocity,
}: {
  latest: AnalyticsPoint;
  birthWeight: number;
  earlyVelocity: AnalyticsVelocity | null;
}) {
  const pct = (latest.weightGrams - birthWeight) / birthWeight;
  const pctLabel = `${pct >= 0 ? "+" : ""}${(pct * 100).toFixed(1)}%`;
  const recovered = latest.weightGrams >= birthWeight;

  let statusText: string;
  let variant: BadgeVariant = "secondary";
  if (recovered) {
    statusText = "Вес восстановлен";
    variant = "default";
  } else if (Math.abs(pct) <= 0.07) {
    statusText = "Физиологическая потеря (норма)";
  } else if (Math.abs(pct) <= 0.1) {
    statusText = "Потеря на границе нормы";
  } else {
    statusText = "Потеря выше нормы";
    variant = "destructive";
  }

  const ev = earlyVelocity;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          Адаптация (первые 14 дней)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-baseline gap-3">
          <div className="text-2xl font-semibold tabular-nums">{pctLabel}</div>
          <div className="text-xs text-muted-foreground">от веса рождения</div>
        </div>
        <Badge variant={variant}>{statusText}</Badge>
        {ev && ev.earlyClass && ev.earlyRef ? (
          <div className="pt-2 text-xs text-muted-foreground">
            ВОЗ ({ev.intervalLabel}, группа {ev.earlyRef.birthWeightGroup} г):{" "}
            <Badge variant={earlyVariant(ev.earlyClass)}>
              {earlyLabel(ev.earlyClass)}
            </Badge>{" "}
            · прибавка {fmtSigned(ev.deltaGrams)}, медиана {ev.earlyRef.p50} г,
            P5 {ev.earlyRef.p5} г
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MonthlyVelocityCard({
  v,
  trend,
}: {
  v: NonNullable<WeightsAnalytics["monthlyVelocity"]>;
  trend: WeightsAnalytics["percentileTrend"];
}) {
  let label: string;
  let variant: BadgeVariant;
  if (v.z >= -1) {
    label = `Темп ${fmtPercentile(v.percentile)} (норма)`;
    variant = "default";
  } else if (v.z >= -2) {
    label = `Темп ${fmtPercentile(v.percentile)} (ниже среднего)`;
    variant = "secondary";
  } else {
    label = `Темп ${fmtPercentile(v.percentile)} (низкий)`;
    variant = "destructive";
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          Темп за завершённый интервал WHO
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="text-2xl font-semibold tabular-nums">
          {fmtSigned(v.deltaGrams)}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({v.fromWeightGrams} → {v.toWeightGrams})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={variant}>{label}</Badge>
          <span className="text-xs text-muted-foreground">
            z = {fmtZ(v.z)} · интервал {v.intervalLabel}
          </span>
        </div>
        {trend ? (
          <div className="text-xs text-muted-foreground">
            Тренд перцентиля: {fmtPercentile(trend.fromPercentile)} →{" "}
            {fmtPercentile(trend.toPercentile)}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
