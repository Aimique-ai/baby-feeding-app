import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";
import { Button } from "@/components/ui/button";
import { Muted } from "@/components/ui/typography";
import { weightsKey } from "@/components/day-view/feedingsKey";
import { dayOfLife } from "@leon/domain/planning/dayBoundary";
import { getBrowserTz } from "@/lib/time/browserTz";
import { listWeights } from "@/lib/api/weights";
import { WeightSheet, type WeightSheetMode } from "./WeightSheet";

export function WeightList({
  tz,
  babyId,
  birthDate,
}: {
  tz: string;
  babyId: string;
  birthDate: string;
}) {
  const effectiveTz = getBrowserTz(tz);
  const q = useQuery({
    queryKey: weightsKey(babyId),
    queryFn: listWeights,
  });
  const [sheetMode, setSheetMode] = useState<WeightSheetMode | null>(null);

  // /api/weights отдаёт список, отсортированный по дате убыванию.
  const weights = q.data ?? [];
  const birth = new Date(birthDate);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-end">
        <Button onClick={() => setSheetMode({ kind: "create" })}>
          Добавить
        </Button>
      </header>

      {q.isLoading ? (
        <Muted className="text-center">Загрузка…</Muted>
      ) : weights.length === 0 ? (
        <Muted className="text-center">Добавь первое взвешивание</Muted>
      ) : (
        <ul className="space-y-2">
          {weights.map((w, i) => {
            const dateLabel = formatInTimeZone(
              new Date(w.date),
              effectiveTz,
              "dd.MM.yyyy",
            );
            const dol = dayOfLife(birth, new Date(w.date), effectiveTz);
            // Следующий элемент — хронологически предыдущее взвешивание.
            const delta =
              i + 1 < weights.length
                ? w.weightGrams - weights[i + 1].weightGrams
                : null;
            const deltaClass =
              delta == null || delta === 0
                ? "text-muted-foreground"
                : delta > 0
                  ? "text-success"
                  : "text-destructive";
            return (
              <li key={w._id}>
                <Button
                  variant="outline"
                  onClick={() => setSheetMode({ kind: "edit", weight: w })}
                  aria-label={`Взвешивание ${dateLabel}, ${w.weightGrams} г`}
                  className="h-auto w-full flex-col items-stretch gap-0 px-3 py-2 text-left font-normal"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="font-medium">{dateLabel}</span>
                    <span className="text-xs text-muted-foreground">
                      день {dol}
                    </span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between text-sm tabular-nums">
                    <span>{w.weightGrams} г</span>
                    <span className={deltaClass}>
                      {delta == null
                        ? "—"
                        : delta > 0
                          ? `+${delta} г`
                          : delta < 0
                            ? `−${Math.abs(delta)} г`
                            : "0"}
                    </span>
                  </div>
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {sheetMode && (
        <WeightSheet
          key={sheetMode.kind === "edit" ? sheetMode.weight._id : "create"}
          open
          onOpenChange={(v) => {
            if (!v) setSheetMode(null);
          }}
          mode={sheetMode}
          tz={effectiveTz}
          babyId={babyId}
        />
      )}
    </div>
  );
}
