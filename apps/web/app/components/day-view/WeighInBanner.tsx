
import { useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  /** ISO date of "today" in local TZ; used as the localStorage dismissal key. */
  dateISO: string;
  /** Days since last weighing. */
  daysSinceLastWeight: number;
};

export function WeighInBanner({ dateISO, daysSinceLastWeight }: Props) {
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
  if (daysSinceLastWeight < 3) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-between rounded-md border bg-accent/40 px-3 py-2 text-sm"
    >
      <span>
        Пора взвесить — последнее взвешивание {daysSinceLastWeight} дн. назад.
      </span>
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
