import { useMemo, useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "~/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { weightsAnalyticsKey } from "~/lib/queryKeys";
import { getBrowserTz } from "~/lib/time/browserTz";
import { getWeightsAnalytics } from "~/lib/api/weights";
import { WeightVerdict } from "~/features/WeightVerdict";
import { WeightSheet } from "~/features/WeightSheet";
import { localDateISO } from "@leon/domain/planning/dayBoundary";
import type {
  AnalyticsPoint,
  AnalyticsVelocity,
  WeeklyGainRow,
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

  const [sheet, setSheet] = useState<{ open: boolean; prefillDateISO?: string }>(
    { open: false },
  );

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
        <Card>
          <CardContent className="py-4">
            <Skeleton className="h-6 w-48" />
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[0, 1].map((i) => (
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
  const inAdaptation = analytics.ageDaysNow < 14;

  return (
    <section className="space-y-4">
      <WeightVerdict
        analytics={analytics}
        todayISO={localDateISO(new Date(), effectiveTz)}
        onAddWeighIn={(prefillDateISO) =>
          setSheet({ open: true, prefillDateISO })
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              <InfoHint text="Перцентиль — место ребёнка среди здоровых сверстников по данным ВОЗ. P50 — медиана. P3–P97 — норма. Высокий перцентиль — просто «выше медианы», не повод для тревоги." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {fmtPercentile(latest.percentile)}
            </div>
            <div className="text-xs text-muted-foreground tabular-nums">
              z = {fmtZ(latest.zWeightForAge)} · возраст {latest.ageDays} дн
              {latest.zWeightForAge > 2 ? " · выше медианы" : ""}
            </div>
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

      {analytics.weeklyGain.length > 0 ? (
        <WeeklyGainCard rows={analytics.weeklyGain} />
      ) : null}

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
            <InfoHint text="Позиция ребёнка в популяции по ВОЗ во времени. Идеально — ровная линия (растёт по своей кривой). Зелёная зона P3–P97 — норма, P50 — медиана." />
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
              {/* Подсветка коридора нормы P3–P97. */}
              <ReferenceLine
                y={3}
                stroke="var(--destructive)"
                strokeOpacity={0.35}
              />
              <ReferenceLine
                y={97}
                stroke="var(--destructive)"
                strokeOpacity={0.35}
              />
              <ReferenceLine
                y={50}
                stroke="var(--muted-foreground)"
                strokeOpacity={0.4}
                strokeDasharray="4 4"
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

      <WeightSheet
        open={sheet.open}
        onOpenChange={(v) => setSheet((s) => ({ ...s, open: v }))}
        mode={{ kind: "create", prefillDateISO: sheet.prefillDateISO }}
        tz={tz}
        babyId={babyId}
      />
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
  const lossPct = Math.abs(Math.min(0, pct)) * 100;

  let statusText: string;
  let variant: BadgeVariant = "secondary";
  if (recovered) {
    statusText = "Вес восстановлен";
    variant = "default";
  } else if (lossPct > 10) {
    statusText = "Потеря больше 10% от рождения";
    variant = "destructive";
  } else {
    // Single message below 10%: an observation, without a "7% = normal" line.
    statusText = "Идёт физиологическая потеря";
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
        <div className="text-xs text-muted-foreground">
          У детей на ИВ потеря обычно меньше и вес возвращается быстрее, чем на
          ГВ.
        </div>
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

function WeeklyGainCard({ rows }: { rows: WeeklyGainRow[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-1">
          Прибавка по отрезкам
          <InfoHint text="Прибавка считается по отрезкам не короче 7 дней — на коротких промежутках шум весов искажает г/сут. Первые ~14 дней (адаптация) показаны отдельно как потеря и восстановление. г/сут — вторичный ориентир (~20–30 г/сут); первичен темп ВОЗ выше." />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Отрезок</TableHead>
              <TableHead className="text-right">Вес</TableHead>
              <TableHead className="text-right">Δ</TableHead>
              <TableHead className="text-right">
                <span className="inline-flex items-center gap-1 justify-end">
                  г/сут
                  <InfoHint text="Средняя прибавка за сутки на отрезке. Вторичный ориентир ~20–30 г/сут; первичный сигнал — темп ВОЗ выше. В адаптации не считается (там идёт потеря и восстановление, а не набор)." />
                </span>
              </TableHead>
              <TableHead className="text-right">Перцентиль</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows
              .slice()
              .reverse()
              .map((r) => (
                <TableRow key={`${r.kind}-${r.fromDay}-${r.toDay}`}>
                  <TableCell className="tabular-nums">
                    {r.fromDay}–{r.toDay} дн
                    {r.kind === "adaptation" ? (
                      <span className="ml-1 text-xs text-muted-foreground">
                        адаптация
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {r.fromGrams} → {r.toGrams}
                    {r.kind === "adaptation" && r.nadirGrams !== undefined ? (
                      <div className="text-xs">
                        минимум {r.nadirGrams} (день {r.nadirDay})
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.kind === "adaptation" ? (
                      <span className="text-muted-foreground">
                        {r.lossPct !== undefined
                          ? r.recovered
                            ? "восстановлен"
                            : `−${r.lossPct.toFixed(1)}%`
                          : "—"}
                      </span>
                    ) : (
                      fmtSigned(r.deltaGrams)
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.gramsPerDay !== null ? (
                      fmtSigned(r.gramsPerDay)
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtPercentile(r.percentile)}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
