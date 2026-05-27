
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { clearActiveBabyId, writeActiveBabyId } from "~/lib/baby/active";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { differenceInCalendarDays } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { Button } from "@/components/ui/button";
import { Muted } from "@/components/ui/typography";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useFeedingTimerOptional } from "@/components/feeding-sheet/FeedingTimerProvider";
import { BabyForm } from "./BabyForm";
import type { BabyFormPayload } from "~/lib/forms/babyForm";
import {
  babiesKey,
  archivedBabiesKey,
} from "@/components/day-view/feedingsKey";
import type { SerializedBaby } from "@leon/contracts/serialized";
import { getBrowserTz } from "@/lib/time/browserTz";
import { archiveBaby, createBaby, listBabies } from "@/lib/api/babies";
import { httpStatus } from "@/lib/api/errors";

type Props = {
  babies: SerializedBaby[];
  activeBabyId: string | null;
  tz: string;
};

export function BabyList({ babies: initialData, activeBabyId, tz }: Props) {
  const effectiveTz = getBrowserTz(tz);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSeq, setCreateSeq] = useState(0);
  const timer = useFeedingTimerOptional();
  const timerRunning = timer?.isRunning ?? false;

  const q = useQuery({
    queryKey: babiesKey,
    queryFn: () => listBabies(),
    initialData,
  });

  const createMutation = useMutation({
    mutationFn: async (data: BabyFormPayload) => {
      try {
        return await createBaby(data);
      } catch (err) {
        if (httpStatus(err) === 409) throw new Error("duplicate_name");
        throw err;
      }
    },
    onSuccess: async (created) => {
      writeActiveBabyId(created._id);
      qc.removeQueries({ queryKey: ["baby"] });
      qc.removeQueries({ queryKey: ["feedings"] });
      qc.removeQueries({ queryKey: ["weights"] });
      qc.removeQueries({ queryKey: ["medications"] });
      qc.invalidateQueries({ queryKey: babiesKey });
      setCreateOpen(false);
      toast.success("Ребёнок создан");
      navigate("/");
    },
    onError: (e: Error) => {
      if (e.message === "duplicate_name") {
        setCreateError("Ребёнок с таким именем уже существует");
      } else {
        toast.error("Не удалось создать");
      }
    },
  });

  const switchMutation = useMutation({
    mutationFn: async (babyId: string) => {
      writeActiveBabyId(babyId);
      return { babyId };
    },
    onSuccess: () => {
      qc.removeQueries({ queryKey: ["baby"] });
      qc.removeQueries({ queryKey: ["feedings"] });
      qc.removeQueries({ queryKey: ["weights"] });
      qc.removeQueries({ queryKey: ["medications"] });
      qc.invalidateQueries({ queryKey: babiesKey });
      navigate("/");
    },
    onError: () => toast.error("Не удалось переключить"),
  });

  const archiveMutation = useMutation({
    mutationFn: (babyId: string) => archiveBaby(babyId),
    onSuccess: (_data, babyId) => {
      qc.invalidateQueries({ queryKey: babiesKey });
      qc.invalidateQueries({ queryKey: archivedBabiesKey });
      toast.success("Архивирован");
      if (babyId === activeBabyId) {
        // Clear stale localStorage; next baby-scoped request will let the
        // server fall back and echo a new active id (or 412 → /babies).
        clearActiveBabyId();
      }
    },
    onError: () => toast.error("Не удалось архивировать"),
  });

  const list = q.data ?? [];

  return (
    <div className="mx-auto max-w-screen-sm px-4 py-4 space-y-4">
      <header className="flex items-center justify-end">
        <div className="flex items-center gap-2">
          <Link
            to="/babies/archive"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Архив →
          </Link>
          <Button onClick={() => { setCreateError(null); setCreateOpen(true); setCreateSeq((s) => s + 1); }}>
            + Создать
          </Button>
        </div>
      </header>

      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-12">
          <Muted>Нет детей.</Muted>
          <Button size="lg" onClick={() => { setCreateError(null); setCreateOpen(true); setCreateSeq((s) => s + 1); }}>
            Создать ребёнка
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map((baby) => {
            const isActive = baby._id === activeBabyId;
            const birthLocal = toZonedTime(new Date(baby.birthDate), effectiveTz);
            const nowLocal = toZonedTime(new Date(), effectiveTz);
            const ageDays = Math.max(
              0,
              differenceInCalendarDays(nowLocal, birthLocal),
            );
            return (
              <li
                key={baby._id}
                className={
                  "flex items-center justify-between rounded border px-3 py-2 " +
                  (isActive ? "border-primary bg-primary/5" : "")
                }
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{baby.name}</span>
                    {isActive && (
                      <span className="text-xs text-primary">✓ активный</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatInTimeZone(new Date(baby.birthDate), effectiveTz, "dd.MM.yyyy")} · день {ageDays}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {!isActive &&
                    (timerRunning ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span tabIndex={0}>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled
                              aria-disabled="true"
                            >
                              Выбрать
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          Идёт кормление текущего ребёнка — остановите таймер
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => switchMutation.mutate(baby._id)}
                        disabled={switchMutation.isPending}
                      >
                        Выбрать
                      </Button>
                    ))}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => archiveMutation.mutate(baby._id)}
                    disabled={archiveMutation.isPending}
                  >
                    В архив
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          if (!o) setCreateOpen(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новый ребёнок</DialogTitle>
          </DialogHeader>
          <BabyForm
            key={createSeq}
            onSubmit={(data) => createMutation.mutate(data)}
            isPending={createMutation.isPending}
            submitError={createError}
            tz={effectiveTz}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
