
import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { fmtMl } from "@/lib/format/ml";
import { Muted } from "@/components/ui/typography";
import { getBrowserTz } from "@/lib/time/browserTz";
import { fetchHistoryPage } from "@/lib/api/history";

function fmtAvgDuration(ms: number | null): string {
  if (ms == null) return "—";
  return `${Math.round(ms / 60000)} мин`;
}

export function HistoryList({ tz }: { tz: string }) {
  const effectiveTz = getBrowserTz(tz);
  const q = useInfiniteQuery({
    queryKey: ["history", effectiveTz],
    queryFn: ({ pageParam }) => fetchHistoryPage(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!sentinelRef.current) return;
    const el = sentinelRef.current;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && q.hasNextPage && !q.isFetchingNextPage) {
          q.fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [q]);

  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div>
      <ul className="mt-4 space-y-2">
        {items.map((it) => {
          const isNeonatal = it.target == null || it.deficit == null;
          const deficit = it.deficit;
          const deficitClass =
            deficit == null
              ? "text-muted-foreground"
              : deficit > 0
                ? "text-destructive"
                : deficit < 0
                  ? "text-emerald-600"
                  : "text-muted-foreground";
          const ariaLabel = isNeonatal
            ? `День ${it.dol}, ${it.dateISO}, ${Math.round(it.factOfDay)} мл, ${it.feedingsCount} кормлений`
            : `День ${it.dol}, ${it.dateISO}, ${Math.round(it.factOfDay)}/${Math.round(it.target as number)} мл`;
          return (
            <li key={it.dateISO}>
              <Link
                to={`/history/${it.dateISO}`}
                prefetch="none"
                aria-label={ariaLabel}
                className="block rounded-md border px-3 py-2 hover:bg-accent"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-medium">{it.dateISO}</span>
                  <span className="text-xs text-muted-foreground">
                    день {it.dol}
                  </span>
                </div>
                <div className="mt-1 flex items-baseline justify-between text-sm tabular-nums">
                  {isNeonatal ? (
                    <span>
                      {fmtMl(it.factOfDay)} · {it.feedingsCount} кормлений
                    </span>
                  ) : (
                    <>
                      <span>
                        {fmtMl(it.factOfDay)} / {fmtMl(it.target as number)}
                      </span>
                      <span className={deficitClass}>
                        {(deficit as number) > 0
                          ? `−${fmtMl(deficit as number)}`
                          : (deficit as number) < 0
                            ? `+${fmtMl(-(deficit as number))}`
                            : "0"}
                      </span>
                    </>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {it.feedingsCount} кормлений + {it.topUpsCount} докормов · ср.{" "}
                  {fmtAvgDuration(it.avgDurationMs)}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      <div ref={sentinelRef} aria-hidden className="h-8" />
      {q.isFetchingNextPage && (
        <Muted className="text-center">Загрузка…</Muted>
      )}
      {!q.hasNextPage && items.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          Это начало истории.
        </p>
      )}
    </div>
  );
}
