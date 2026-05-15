"use client";

import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { NumberStepper } from "@/components/ui/number-stepper";
import { feedingsKey, medicationsKey } from "@/components/day-view/feedingsKey";
import type {
  SerializedFeeding,
  SerializedMedication,
} from "@/lib/api/serializedTypes";
import { getBrowserTz, tzHeaders } from "@/lib/time/browserTz";
import { fromZonedTime, toZonedTime, format as fmtTz } from "date-fns-tz";

type Mode =
  | {
      kind: "create";
      preset?: {
        time?: Date;
        volumeMl?: number;
        startAt?: Date;
        durationMin?: number;
      };
    }
  | { kind: "edit"; feeding: SerializedFeeding };

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: Mode;
  dateISO: string;
  tz: string;
  babyId: string;
};

const DURATION_CHIPS = [10, 12, 15, 20];
const START_OFFSETS = [0, -5, -10, -15];

function roundTo5Min(d: Date): Date {
  const ms = d.getTime();
  const FIVE = 5 * 60 * 1000;
  return new Date(Math.round(ms / FIVE) * FIVE);
}

function fmtLocalForInput(d: Date, tz: string): string {
  // YYYY-MM-DDTHH:mm in the user's IANA timezone, for <input type="datetime-local">
  return fmtTz(toZonedTime(d, tz), "yyyy-MM-dd'T'HH:mm", { timeZone: tz });
}

function parseLocalInput(s: string, tz: string): Date {
  // Treat the wall-clock string as `tz`, not as the device's local zone.
  return fromZonedTime(s, tz);
}

async function fetchMedications(): Promise<SerializedMedication[]> {
  const r = await fetch("/api/medications", { cache: "no-store" });
  if (!r.ok) throw new Error("medications fetch failed");
  return r.json();
}

async function fetchMedication(id: string): Promise<SerializedMedication> {
  const r = await fetch(`/api/medications/${id}`, { cache: "no-store" });
  if (!r.ok) throw new Error("medication fetch failed");
  return r.json();
}

export function FeedingSheet({
  open,
  onOpenChange,
  mode,
  dateISO,
  tz,
  babyId,
}: Props) {
  const effectiveTz = getBrowserTz(tz);
  const initial = (() => {
    if (mode.kind === "edit") {
      const f = mode.feeding;
      return {
        startAt: new Date(f.startAt),
        durationMin:
          f.endAt
            ? Math.round(
                (new Date(f.endAt).getTime() -
                  new Date(f.startAt).getTime()) /
                  60000,
              )
            : 15,
        volumeMl: f.volumeMl ?? 0,
        medicationId: f.medicationId,
        medicationDoseDrops: f.medicationDoseDrops,
      };
    }
    const presetStartAt = mode.preset?.startAt;
    return {
      startAt: presetStartAt ?? roundTo5Min(mode.preset?.time ?? new Date()),
      durationMin: mode.preset?.durationMin ?? 15,
      volumeMl: mode.preset?.volumeMl ?? 0,
      medicationId: null as string | null,
      medicationDoseDrops: null as number | null,
    };
  })();

  const [startAt, setStartAt] = useState<Date>(initial.startAt);
  const [durationMin, setDurationMin] = useState<number>(initial.durationMin);
  const [volumeMl, setVolumeMl] = useState<number>(initial.volumeMl);
  const [medicationId, setMedicationId] = useState<string | null>(
    initial.medicationId,
  );
  const [medDoseDrops, setMedDoseDrops] = useState<number | null>(
    initial.medicationDoseDrops,
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isMobile = useIsMobile();
  // Field-level errors are computed at submit time (not during render) to keep
  // this component pure for React 19's strict rules.
  const [submitError, setSubmitError] = useState<string | null>(null);

  const qc = useQueryClient();

  const medsQ = useQuery({
    queryKey: medicationsKey(babyId),
    queryFn: fetchMedications,
  });

  const activeMeds = medsQ.data ?? [];
  const selectedInActive =
    medicationId != null && activeMeds.some((m) => m._id === medicationId);
  const needArchivedFetch =
    medicationId != null && medsQ.isSuccess && !selectedInActive;

  const archivedQ = useQuery({
    queryKey: ["medication", medicationId],
    queryFn: () => fetchMedication(medicationId!),
    enabled: needArchivedFetch,
  });

  const archivedMed =
    needArchivedFetch && archivedQ.data ? archivedQ.data : null;

  type FeedingBody = {
    startAt: Date;
    endAt: Date | null;
    volumeMl: number;
    medicationId: string | null;
    medicationDoseDrops: number | null;
  };

  const createMutation = useMutation<
    SerializedFeeding,
    Error,
    FeedingBody,
    { prev: SerializedFeeding[] }
  >({
    mutationFn: async (body) => {
      const r = await fetch("/api/feedings", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...tzHeaders(effectiveTz) },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onMutate: async (body) => {
      const key = feedingsKey(babyId, dateISO, effectiveTz);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<SerializedFeeding[]>(key) ?? [];
      const optimistic: SerializedFeeding = {
        _id: `temp-${body.startAt.getTime()}-${prev.length}`,
        babyId,
        startAt: body.startAt.toISOString(),
        endAt: body.endAt ? body.endAt.toISOString() : null,
        volumeMl: body.volumeMl,
        isTopUp: false,
        parentFeedingId: null,
        medicationId: body.medicationId,
        medicationDoseDrops: body.medicationDoseDrops,
      };
      qc.setQueryData(key, [...prev, optimistic]);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(feedingsKey(babyId, dateISO, effectiveTz), ctx.prev);
      }
      toast.error("Не удалось сохранить");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: feedingsKey(babyId, dateISO, effectiveTz) });
      toast.success("Сохранено");
      onOpenChange(false);
    },
  });

  const patchMutation = useMutation<SerializedFeeding, Error, FeedingBody>({
    mutationFn: async (body) => {
      if (mode.kind !== "edit") throw new Error("not edit mode");
      const r = await fetch(`/api/feedings/${mode.feeding._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...tzHeaders(effectiveTz) },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: feedingsKey(babyId, dateISO, effectiveTz) });
      toast.success("Сохранено");
      onOpenChange(false);
    },
    onError: () => toast.error("Не удалось сохранить"),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (mode.kind !== "edit") throw new Error("not edit mode");
      const r = await fetch(`/api/feedings/${mode.feeding._id}`, {
        method: "DELETE",
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: feedingsKey(babyId, dateISO, effectiveTz) });
      toast.success("Удалено");
      setConfirmDelete(false);
      onOpenChange(false);
    },
    onError: () => toast.error("Не удалось удалить"),
  });

  const isPending =
    createMutation.isPending ||
    patchMutation.isPending ||
    deleteMutation.isPending;

  const endAt =
    durationMin > 0
      ? new Date(startAt.getTime() + durationMin * 60 * 1000)
      : null;

  const durationError = durationMin > 180 ? "Не более 180 минут" : null;
  const volumeError =
    volumeMl <= 0
      ? "Объём обязателен"
      : volumeMl > 200
        ? "От 0 до 200 мл"
        : null;
  const staticError = durationError || volumeError;

  const showMedSection = activeMeds.length > 0 || archivedMed !== null;

  function selectMed(m: SerializedMedication) {
    if (m._id === medicationId) return;
    setMedicationId(m._id);
    setMedDoseDrops(m.defaultDoseDrops);
  }

  function selectNoMed() {
    if (medicationId === null) return;
    setMedicationId(null);
    setMedDoseDrops(null);
  }

  function submit() {
    if (staticError) {
      setSubmitError(staticError);
      return;
    }
    if (startAt.getTime() > Date.now()) {
      setSubmitError("Время в будущем");
      return;
    }
    setSubmitError(null);
    const body: FeedingBody = {
      startAt,
      endAt,
      volumeMl,
      medicationId,
      medicationDoseDrops: medDoseDrops,
    };
    if (mode.kind === "edit") {
      patchMutation.mutate(body);
    } else {
      createMutation.mutate(body);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className="max-h-[90vh] overflow-y-auto sm:max-h-full"
        >
          <SheetHeader>
            <SheetTitle>
              {mode.kind === "edit" ? "Редактировать кормление" : "Новое кормление"}
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-5 px-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="startAt">Начало</Label>
              <div className="flex flex-wrap gap-2">
                {START_OFFSETS.map((off) => (
                  <Button
                    key={off}
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setStartAt(roundTo5Min(new Date(Date.now() + off * 60_000)))
                    }
                  >
                    {off === 0 ? "Сейчас" : `${off}`}
                  </Button>
                ))}
                {mode.kind === "create" && mode.preset?.time && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setStartAt(mode.preset!.time!)}
                  >
                    По плану
                  </Button>
                )}
              </div>
              <Input
                id="startAt"
                type="datetime-local"
                value={fmtLocalForInput(startAt, effectiveTz)}
                onChange={(e) =>
                  setStartAt(parseLocalInput(e.target.value, effectiveTz))
                }
              />
              {submitError && (
                <p className="text-xs text-destructive">{submitError}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Длительность, мин</Label>
              <ToggleGroup
                type="single"
                size="sm"
                spacing={2}
                value={
                  DURATION_CHIPS.includes(durationMin)
                    ? String(durationMin)
                    : ""
                }
                onValueChange={(v) => {
                  if (v) setDurationMin(Number(v));
                }}
              >
                {DURATION_CHIPS.map((d) => (
                  <ToggleGroupItem key={d} value={String(d)} aria-label={`${d} минут`}>
                    {d}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <Input
                id="duration"
                type="number"
                min={0}
                max={180}
                value={durationMin}
                onChange={(e) => setDurationMin(Number(e.target.value))}
              />
              {durationError && (
                <p className="text-xs text-destructive">{durationError}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="volume">Объём, мл</Label>
              <NumberStepper
                id="volume"
                value={volumeMl}
                onChange={setVolumeMl}
                min={0}
                max={200}
                step={5}
              />
              {volumeError && (
                <p className="text-xs text-destructive">{volumeError}</p>
              )}
            </div>

            {showMedSection && (
              <div className="space-y-2">
                <Label>Лекарство</Label>
                <ToggleGroup
                  type="single"
                  size="sm"
                  spacing={2}
                  value={medicationId ?? "none"}
                  onValueChange={(v) => {
                    if (!v) return;
                    if (v === "none") {
                      selectNoMed();
                      return;
                    }
                    const med =
                      activeMeds.find((m) => m._id === v) ??
                      (archivedMed && archivedMed._id === v ? archivedMed : null);
                    if (med) selectMed(med);
                  }}
                  className="flex-wrap"
                >
                  <ToggleGroupItem value="none">Без</ToggleGroupItem>
                  {activeMeds.map((m) => (
                    <ToggleGroupItem key={m._id} value={m._id}>
                      {m.name}
                    </ToggleGroupItem>
                  ))}
                  {archivedMed && (
                    <ToggleGroupItem value={archivedMed._id}>
                      {archivedMed.name} (архив)
                    </ToggleGroupItem>
                  )}
                </ToggleGroup>
                {medicationId !== null && medDoseDrops !== null && (
                  <NumberStepper
                    id="medDose"
                    value={medDoseDrops}
                    onChange={setMedDoseDrops}
                    min={1}
                    max={100}
                    step={1}
                    decrementLabel="Уменьшить на 1 каплю"
                    incrementLabel="Увеличить на 1 каплю"
                  />
                )}
              </div>
            )}
          </div>

          <SheetFooter className="gap-2">
            {mode.kind === "edit" && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setConfirmDelete(true)}
                disabled={isPending}
              >
                Удалить
              </Button>
            )}
            <SheetClose asChild>
              <Button type="button" variant="ghost" disabled={isPending}>
                Отмена
              </Button>
            </SheetClose>
            <Button
              type="button"
              onClick={submit}
              disabled={!!staticError || isPending}
            >
              Сохранить
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить кормление?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                deleteMutation.mutate();
              }}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
