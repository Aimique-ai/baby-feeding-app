"use client";

import { Play, Plus, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useFeedingSheet } from "@/components/feeding-sheet/FeedingSheetProvider";
import { useFeedingTimerCtx } from "@/components/feeding-sheet/FeedingTimerProvider";
import { useElapsed } from "@/hooks/useFeedingTimer";

type Props = {
  babyId: string | null;
};

export function AppHeader({ babyId }: Props) {
  const hasActiveBaby = babyId != null;
  const { openCreate } = useFeedingSheet();
  const { startedAt, isRunning, start, stop } = useFeedingTimerCtx();
  const elapsed = useElapsed(startedAt);

  function handleStop() {
    const result = stop();
    if (!result) return;
    const { startAt, durationMin } = result;
    if (durationMin > 180) {
      toast.warning(
        "Таймер шел более 3 часов — кормление сохранено без длительности, проверьте перед сохранением",
      );
      openCreate({ preset: { startAt, durationMin: 0 } });
      return;
    }
    openCreate({ preset: { startAt, durationMin } });
  }

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur">
      <SidebarTrigger className="md:hidden" />
      <span className="text-sm font-medium">Leon</span>
      <div className="ml-auto flex items-center gap-2">
        {hasActiveBaby && (
          <>
            {isRunning ? (
              <Button
                size="sm"
                variant="destructive"
                onClick={handleStop}
                aria-label={`Остановить кормление, идёт ${elapsed}`}
              >
                <Square className="size-4" aria-hidden />
                <span className="tabular-nums">{elapsed}</span>
              </Button>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                onClick={start}
                aria-label="Старт кормления"
              >
                <Play className="size-4" aria-hidden />
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => openCreate()}
              aria-label="Новое кормление"
            >
              <Plus className="size-4" aria-hidden />
              <span className="hidden sm:inline">Кормление</span>
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
