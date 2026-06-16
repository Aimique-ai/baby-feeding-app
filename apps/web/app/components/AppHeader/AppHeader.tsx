import { Play, Plus, Square } from "lucide-react";
import { useLocation } from "react-router";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { ThemeToggle } from "~/components/ThemeToggle";
import { useFeedingSheet } from "~/features/FeedingSheetProvider";
import { useFeedingTimerCtx } from "~/features/FeedingTimerProvider";
import { useElapsed } from "~/features/FeedingTimerProvider";
import { navItems } from "~/components/SideNav/navItems";

type Props = {
  babyId: string | null;
};

export function AppHeader({ babyId }: Props) {
  const hasActiveBaby = babyId != null;
  const { openCreate } = useFeedingSheet();
  const { startedAt, isRunning, start, stop } = useFeedingTimerCtx();
  const elapsed = useElapsed(startedAt);
  const pathname = useLocation().pathname;
  const pageTitle = navItems.find((t) => t.match(pathname))?.label ?? "";

  async function handleStop() {
    let result: Awaited<ReturnType<typeof stop>>;
    try {
      result = await stop();
    } catch {
      toast.error("Не удалось остановить таймер — проверьте соединение");
      return;
    }
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
      <SidebarTrigger className="-ml-1" />
      <Separator
        orientation="vertical"
        className="mr-1 data-[orientation=vertical]:h-4"
      />
      <h1 className="text-base font-semibold">{pageTitle}</h1>
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
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
