"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import { fmtMl } from "@/lib/format/ml";

type DayItem = {
  dateISO: string;
  dol: number;
  target: number;
  factOfDay: number;
  feedingsCount: number;
  topUpsCount: number;
  avgDurationMs: number | null;
  deficit: number;
};

type Page = {
  items: DayItem[];
  nextCursor: string | null;
};

async function fetchPage({
  pageParam,
}: {
  pageParam: string | null;
}): Promise<Page> {
  const url = pageParam
    ? `/api/history?cursor=${pageParam}`
    : `/api/history`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error("history fetch failed");
  return r.json();
}

function fmtAvgDuration(ms: number | null): string {
  if (ms == null) return "—";
  return `${Math.round(ms / 60000)} мин`;
}

export function HistoryList() {
  const q = useInfiniteQuery({
    queryKey: ["history"],
    queryFn: fetchPage,
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
    <div className="mx-auto max-w-screen-sm px-4 py-4">
      <h1 className="mb-4 text-lg font-semibold">История</h1>
      <ul className="space-y-2">
        {items.map((it) => {
          const deficitClass =
            it.deficit > 0
              ? "text-destructive"
              : it.deficit < 0
                ? "text-emerald-600"
                : "text-muted-foreground";
          return (
            <li key={it.dateISO}>
              <Link
                href={`/history/${it.dateISO}`}
                prefetch={false}
                aria-label={`День ${it.dol}, ${it.dateISO}, ${Math.round(it.factOfDay)}/${Math.round(it.target)} мл`}
                className="block rounded-md border px-3 py-2 hover:bg-accent"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-medium">{it.dateISO}</span>
                  <span className="text-xs text-muted-foreground">
                    день {it.dol}
                  </span>
                </div>
                <div className="mt-1 flex items-baseline justify-between text-sm tabular-nums">
                  <span>
                    {fmtMl(it.factOfDay)} / {fmtMl(it.target)}
                  </span>
                  <span className={deficitClass}>
                    {it.deficit > 0
                      ? `−${fmtMl(it.deficit)}`
                      : it.deficit < 0
                        ? `+${fmtMl(-it.deficit)}`
                        : "0"}
                  </span>
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
        <p className="text-center text-sm text-muted-foreground">
          Загрузка…
        </p>
      )}
      {!q.hasNextPage && items.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          Это начало истории.
        </p>
      )}
    </div>
  );
}
