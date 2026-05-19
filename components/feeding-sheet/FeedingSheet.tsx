"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { NumberStepper } from "@/components/ui/number-stepper";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { feedingsKey, medicationsKey } from "@/components/day-view/feedingsKey";
import type {
  SerializedFeeding,
  SerializedMedication,
} from "@/lib/api/serializedTypes";
import { getBrowserTz, tzHeaders } from "@/lib/time/browserTz";
import { fromZonedTime, toZonedTime, format as fmtTz } from "date-fns-tz";
import {
  feedingFormSchema,
  toFeedingApiBody,
  type FeedingApiBody,
  type FeedingFormOut,
  type FeedingFormValues,
} from "@/lib/schemas/forms/feedingForm";

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
  const initial: FeedingFormValues = (() => {
    if (mode.kind === "edit") {
      const f = mode.feeding;
      return {
        startAt: new Date(f.startAt),
        // Если у кормления нет endAt — длительность пустая ("") , чтобы
        // редактирование без правки длительности не дописывало endAt.
        durationMin: f.endAt
          ? Math.round(
              (new Date(f.endAt).getTime() -
                new Date(f.startAt).getTime()) /
                60000,
            )
          : "",
        volumeMl: f.volumeMl ?? 0,
        isTopUp: f.isTopUp,
        medicationId: f.medicationId,
        medDoseDrops: f.medicationDoseDrops,
      };
    }
    const presetStartAt = mode.preset?.startAt;
    return {
      startAt: presetStartAt ?? roundTo5Min(mode.preset?.time ?? new Date()),
      durationMin: mode.preset?.durationMin ?? 15,
      volumeMl: mode.preset?.volumeMl ?? 0,
      isTopUp: false,
      medicationId: null,
      medDoseDrops: null,
    };
  })();

  const form = useForm<FeedingFormValues, unknown, FeedingFormOut>({
    resolver: zodResolver(feedingFormSchema),
    defaultValues: initial,
  });

  const [confirmDelete, setConfirmDelete] = useState(false);
  const isMobile = useIsMobile();

  const qc = useQueryClient();

  const medicationId = useWatch({
    control: form.control,
    name: "medicationId",
  });

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

  const createMutation = useMutation<
    SerializedFeeding,
    Error,
    FeedingApiBody,
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
        isTopUp: body.isTopUp,
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

  const patchMutation = useMutation<SerializedFeeding, Error, FeedingApiBody>({
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

  const showMedSection = activeMeds.length > 0 || archivedMed !== null;

  function selectMed(m: SerializedMedication) {
    if (m._id === medicationId) return;
    form.setValue("medicationId", m._id);
    form.setValue("medDoseDrops", m.defaultDoseDrops);
  }

  function selectNoMed() {
    if (medicationId === null) return;
    form.setValue("medicationId", null);
    form.setValue("medDoseDrops", null);
  }

  function onValid(v: FeedingFormOut) {
    const body = toFeedingApiBody(v);
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

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onValid)} className="contents">
              <div className="space-y-5 px-4 py-2">
                <FormField
                  control={form.control}
                  name="startAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="startAt">Начало</FormLabel>
                      <div className="flex flex-wrap gap-2">
                        {START_OFFSETS.map((off) => (
                          <Button
                            key={off}
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              field.onChange(
                                roundTo5Min(
                                  new Date(Date.now() + off * 60_000),
                                ),
                              )
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
                            onClick={() => field.onChange(mode.preset!.time!)}
                          >
                            По плану
                          </Button>
                        )}
                      </div>
                      <FormControl>
                        <Input
                          id="startAt"
                          type="datetime-local"
                          value={fmtLocalForInput(field.value, effectiveTz)}
                          onChange={(e) =>
                            field.onChange(
                              parseLocalInput(e.target.value, effectiveTz),
                            )
                          }
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="durationMin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="duration">
                        Длительность, мин
                      </FormLabel>
                      <ToggleGroup
                        type="single"
                        size="sm"
                        spacing={2}
                        value={
                          field.value !== "" &&
                          DURATION_CHIPS.includes(field.value)
                            ? String(field.value)
                            : ""
                        }
                        onValueChange={(v) => {
                          if (v) field.onChange(Number(v));
                        }}
                      >
                        {DURATION_CHIPS.map((d) => (
                          <ToggleGroupItem
                            key={d}
                            value={String(d)}
                            aria-label={`${d} минут`}
                          >
                            {d}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                      <FormControl>
                        <Input
                          id="duration"
                          type="number"
                          min={0}
                          max={180}
                          value={field.value}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === ""
                                ? ""
                                : Number(e.target.value),
                            )
                          }
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="volumeMl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="volume">Объём, мл</FormLabel>
                      <FormControl>
                        <NumberStepper
                          id="volume"
                          value={field.value}
                          onChange={field.onChange}
                          min={0}
                          max={200}
                          step={5}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isTopUp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Тип</FormLabel>
                      <ToggleGroup
                        type="single"
                        variant="outline"
                        className="w-full"
                        value={field.value ? "topup" : "main"}
                        onValueChange={(v) => {
                          if (v === "main" || v === "topup")
                            field.onChange(v === "topup");
                        }}
                      >
                        <ToggleGroupItem value="main" className="flex-1">
                          Основное
                        </ToggleGroupItem>
                        <ToggleGroupItem value="topup" className="flex-1">
                          Докорм
                        </ToggleGroupItem>
                      </ToggleGroup>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {showMedSection && (
                  <FormField
                    control={form.control}
                    name="medDoseDrops"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Лекарство</FormLabel>
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
                              (archivedMed && archivedMed._id === v
                                ? archivedMed
                                : null);
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
                        {medicationId !== null && field.value !== null && (
                          <FormControl>
                            <NumberStepper
                              id="medDose"
                              value={field.value}
                              // Доза при выбранном лекарстве обязательна:
                              // очистка поля возвращает к минимуму (1 капля).
                              onChange={(v) =>
                                field.onChange(v === "" ? 1 : v)
                              }
                              min={1}
                              max={100}
                              step={1}
                              decrementLabel="Уменьшить на 1 каплю"
                              incrementLabel="Увеличить на 1 каплю"
                            />
                          </FormControl>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                <Button type="submit" disabled={isPending}>
                  Сохранить
                </Button>
              </SheetFooter>
            </form>
          </Form>
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
