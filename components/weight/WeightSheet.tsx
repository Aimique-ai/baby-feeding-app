"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  weightsAnalyticsKey,
  weightsKey,
} from "@/components/day-view/feedingsKey";
import type { SerializedWeight } from "@/lib/api/serializedTypes";
import { localDateISO } from "@/lib/planning/dayBoundary";
import { getBrowserTz, tzHeaders } from "@/lib/time/browserTz";
import {
  toWeightApiBody,
  weightFormSchema,
  type WeightFormOut,
  type WeightFormValues,
} from "@/lib/schemas/forms/weightForm";

type Mode =
  | { kind: "create" }
  | { kind: "edit"; weight: SerializedWeight };

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: Mode;
  tz: string;
  babyId: string;
};

type WeightApiBody = { dateISO: string; weightGrams: number };

// Ошибка с пометкой 409 — взвешивание на эту дату уже существует.
class DuplicateDateError extends Error {}

export function WeightSheet({ open, onOpenChange, mode, tz, babyId }: Props) {
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const effectiveTz = getBrowserTz(tz);

  const initial: WeightFormValues = (() => {
    if (mode.kind === "edit") {
      return {
        dateISO: localDateISO(new Date(mode.weight.date), effectiveTz),
        grams: mode.weight.weightGrams,
      };
    }
    return {
      dateISO: localDateISO(new Date(), effectiveTz),
      grams: 3400,
    };
  })();

  const form = useForm<WeightFormValues, unknown, WeightFormOut>({
    resolver: zodResolver(weightFormSchema),
    defaultValues: initial,
  });

  const [confirmDelete, setConfirmDelete] = useState(false);

  function invalidateWeights() {
    qc.invalidateQueries({ queryKey: weightsKey(babyId) });
    qc.invalidateQueries({
      queryKey: weightsAnalyticsKey(babyId, effectiveTz),
    });
  }

  function onMutationError(err: unknown) {
    if (err instanceof DuplicateDateError) {
      toast.error("Взвешивание на эту дату уже есть");
    } else {
      toast.error("Не удалось сохранить");
    }
  }

  // POST /api/weights — upsert по (babyId, date): «создание» на уже
  // существующую дату молча перезапишет вес этого дня. Это намеренно —
  // редактирование происходит через клик по строке списка.
  const createMutation = useMutation({
    mutationFn: async (body: WeightApiBody) => {
      const r = await fetch("/api/weights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...tzHeaders(effectiveTz),
        },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      invalidateWeights();
      toast.success("Вес добавлен");
      onOpenChange(false);
    },
    onError: onMutationError,
  });

  const patchMutation = useMutation({
    mutationFn: async (body: WeightApiBody) => {
      if (mode.kind !== "edit") throw new Error("not edit mode");
      const r = await fetch(`/api/weights/${mode.weight._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...tzHeaders(effectiveTz),
        },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        if (r.status === 409) throw new DuplicateDateError();
        throw new Error(await r.text());
      }
      return r.json();
    },
    onSuccess: () => {
      invalidateWeights();
      toast.success("Сохранено");
      onOpenChange(false);
    },
    onError: onMutationError,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (mode.kind !== "edit") throw new Error("not edit mode");
      const r = await fetch(`/api/weights/${mode.weight._id}`, {
        method: "DELETE",
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      invalidateWeights();
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

  function onValid(v: WeightFormOut) {
    const body = toWeightApiBody(v);
    if (mode.kind === "edit") {
      patchMutation.mutate(body);
    } else {
      createMutation.mutate(body);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side={isMobile ? "bottom" : "right"}>
          <SheetHeader>
            <SheetTitle>
              {mode.kind === "edit"
                ? "Редактировать взвешивание"
                : "Новое взвешивание"}
            </SheetTitle>
          </SheetHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onValid)}
              className="contents"
            >
              <div className="space-y-4 px-4 py-2">
                <FormField
                  control={form.control}
                  name="dateISO"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Дата</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="grams"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Граммы</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={50000}
                          inputMode="numeric"
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
            <AlertDialogTitle>Удалить взвешивание?</AlertDialogTitle>
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

export type { Mode as WeightSheetMode };
