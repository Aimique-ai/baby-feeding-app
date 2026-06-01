import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "~/components/ui/chart";
import { feedingsAnalyticsKey } from "~/lib/queryKeys";
import { getBrowserTz } from "~/lib/time/browserTz";
import { getFeedingsAnalytics } from "~/lib/api/feedings";

const chartConfig = {
  target: {
    label: "Цель, мл",
    color: "var(--chart-2)",
  },
  fact: {
    label: "Факт, мл",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export function FeedingTargetChart({
  babyId,
  tz,
}: {
  babyId: string;
  tz: string;
}) {
  const effectiveTz = getBrowserTz(tz);
  const q = useQuery({
    queryKey: feedingsAnalyticsKey(babyId, effectiveTz),
    queryFn: getFeedingsAnalytics,
  });

  const chartData = useMemo(() => {
    if (!q.data) return [];
    return q.data.items.map((it) => ({
      date: it.dateISO.slice(5).replace("-", "."),
      // Neonatal days have no target — null leaves a gap in the line.
      target: it.target == null ? null : Math.round(it.target),
      fact: Math.round(it.fact),
    }));
  }, [q.data]);

  if (q.isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[260px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!q.data || q.data.items.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Данных пока нет.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          Цель vs факт, 30 дней
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[260px] w-full">
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
              domain={["dataMin - 20", "dataMax + 20"]}
              tickFormatter={(v) => `${v}`}
            />
            <ChartTooltip
              content={<ChartTooltipContent />}
              formatter={(v) => `${v} мл`}
            />
            <Line
              type="monotone"
              dataKey="target"
              stroke="var(--color-target)"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="fact"
              stroke="var(--color-fact)"
              strokeWidth={2}
              dot
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
