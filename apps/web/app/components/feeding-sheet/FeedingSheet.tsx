
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Trash2, ChevronDown } from "lucide-react";
import { ru } from "date-fns/locale/ru";
import {
  feedingsDurationChipsKey,
  feedingsKey,
  medicationsKey,
} from "@/components/day-view/feedingsKey";
import { DEFAULT_DURATION_CHIPS } from "@leon/domain/feeding";
import type { Feeding } from "@leon/schemas/feeding";
import type { Medication } from "@leon/schemas/medication";
import { getBrowserTz } from "@/lib/time/browserTz";
import {
  createFeeding,
  deleteFeeding,
  fetchDurationChips as fetchDurationChipsApi,
  patchFeeding,
} from "@/lib/api/feedings";
import {
  getMedication,
  listMedications,
} from "@/lib/api/medications";
import { fromZonedTime, toZonedTime, format } from "date-fns-tz";
import {
  feedingFormSchema,
  toFeedingApiBody,
  type FeedingApiBody,
  type FeedingFormOut,
  type FeedingFormValues,
} from "~/lib/forms/feedingForm";

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
  | { kind: "edit"; feeding: Feeding };

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: Mode;
  dateISO: string;
  tz: string;
  babyId: string;
};

const DEFAULT_CHIPS: readonly number[] = DEFAULT_DURATION_CHIPS;

// Extract Y-M-D from a Calendar-picked Date (always in device's local tz per
// react-day-picker semantics). Using toZonedTime/format in effectiveTz would
// shift the day on midnight boundaries when device tz ≠ effective tz.
function ymdFromLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function fetchDurationChips(): Promise<number[]> {
  const chips = await fetchDurationChipsApi();
  return chips ?? [...DEFAULT_CHIPS];
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
      startAt: presetStartAt ?? mode.preset?.time ?? new Date(),
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
    queryFn: listMedications,
  });

  const chipsQ = useQuery({
    queryKey: feedingsDurationChipsKey(babyId),
    queryFn: fetchDurationChips,
    staleTime: 5 * 60 * 1000,
    enabled: open,
    placeholderData: DEFAULT_CHIPS as number[],
  });
  const chips = chipsQ.data ?? DEFAULT_CHIPS;

  const activeMeds = medsQ.data ?? [];
  const selectedInActive =
    medicationId != null && activeMeds.some((m) => m._id === medicationId);
  const needArchivedFetch =
    medicationId != null && medsQ.isSuccess && !selectedInActive;

  const archivedQ = useQuery({
    queryKey: ["medication", medicationId],
    queryFn: () => getMedication(medicationId!),
    enabled: needArchivedFetch,
  });

  const archivedMed =
    needArchivedFetch && archivedQ.data ? archivedQ.data : null;

  const createMutation = useMutation<
    Feeding,
    Error,
    FeedingApiBody,
    { prev: Feeding[] }
  >({
    mutationFn: (body) => createFeeding(body),
    onMutate: async (body) => {
      const key = feedingsKey(babyId, dateISO, effectiveTz);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Feeding[]>(key) ?? [];
      const optimistic: Feeding = {
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
      qc.invalidateQueries({ queryKey: feedingsDurationChipsKey(babyId) });
      toast.success("Сохранено");
      onOpenChange(false);
    },
  });

  const patchMutation = useMutation<Feeding, Error, FeedingApiBody>({
    mutationFn: (body) => {
      if (mode.kind !== "edit") throw new Error("not edit mode");
      return patchFeeding(mode.feeding._id, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: feedingsKey(babyId, dateISO, effectiveTz) });
      qc.invalidateQueries({ queryKey: feedingsDurationChipsKey(babyId) });
      toast.success("Сохранено");
      onOpenChange(false);
    },
    onError: () => toast.error("Не удалось сохранить"),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (mode.kind !== "edit") throw new Error("not edit mode");
      await deleteFeeding(mode.feeding._id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: feedingsKey(babyId, dateISO, effectiveTz) });
      qc.invalidateQueries({ queryKey: feedingsDurationChipsKey(babyId) });
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

  function selectMed(m: Medication) {
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

                <FormField
                  control={form.control}
                  name="startAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="startAt">Начало</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                type="button"
                                size="sm"
                                className="justify-between gap-1 font-normal"
                              >
                                {format(
                                  toZonedTime(field.value, effectiveTz),
                                  "d MMMM yyyy",
                                  { timeZone: effectiveTz, locale: ru },
                                )}
                                <ChevronDown className="size-4 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={toZonedTime(field.value, effectiveTz)}
                                captionLayout="dropdown"
                                defaultMonth={toZonedTime(
                                  field.value,
                                  effectiveTz,
                                )}
                                onSelect={(d) => {
                                  if (!d) return;
                                  const ymd = ymdFromLocalDate(d);
                                  const hhmm = format(
                                    toZonedTime(field.value, effectiveTz),
                                    "HH:mm",
                                    { timeZone: effectiveTz },
                                  );
                                  field.onChange(
                                    fromZonedTime(
                                      `${ymd}T${hhmm}`,
                                      effectiveTz,
                                    ),
                                  );
                                }}
                              />
                            </PopoverContent>
                          </Popover>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="flex-1"
                            onClick={() => field.onChange(new Date())}
                          >
                            Сейчас
                          </Button>
                          <Input
                            id="startAt"
                            type="time"
                            value={format(
                              toZonedTime(field.value, effectiveTz),
                              "HH:mm",
                              { timeZone: effectiveTz },
                            )}
                            onChange={(e) => {
                              const hhmm = e.target.value || "00:00";
                              const ymd = format(
                                toZonedTime(field.value, effectiveTz),
                                "yyyy-MM-dd",
                                { timeZone: effectiveTz },
                              );
                              field.onChange(
                                fromZonedTime(`${ymd}T${hhmm}`, effectiveTz),
                              );
                            }}
                            onBlur={field.onBlur}
                            className="h-8 w-24 shrink-0 appearance-none rounded-md border border-input bg-background px-3 text-sm shadow-xs [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                            aria-label="Время"
                          />
                        </div>
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
                          chips.includes(field.value)
                            ? String(field.value)
                            : ""
                        }
                        onValueChange={(v) => {
                          if (v) field.onChange(Number(v));
                        }}
                      >
                        {chips.map((d) => (
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

              <SheetFooter className="flex flex-row items-center justify-between gap-2">
                <Button type="submit" disabled={isPending} className="flex-1">
                  Сохранить
                </Button>
                {mode.kind === "edit" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setConfirmDelete(true)}
                    disabled={isPending}
                    aria-label="Удалить"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
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
