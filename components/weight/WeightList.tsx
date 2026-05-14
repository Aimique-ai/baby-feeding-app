"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  weightsAnalyticsKey,
  weightsKey,
} from "@/components/day-view/feedingsKey";
import { WeightAnalytics } from "./WeightAnalytics";

export function WeightList({
  tz,
  babyId,
}: {
  tz: string;
  babyId: string;
}) {
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [dateISO, setDateISO] = useState(format(new Date(), "yyyy-MM-dd"));
  const [grams, setGrams] = useState<number>(3400);

  const create = useMutation({
    mutationFn: async () => {
      // Local midnight in the user's IANA tz, not UTC midnight.
      const localMidnight = fromZonedTime(`${dateISO}T00:00:00`, tz);
      const r = await fetch("/api/weights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: localMidnight,
          weightGrams: grams,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: weightsKey(babyId) });
      qc.invalidateQueries({ queryKey: weightsAnalyticsKey(babyId) });
      toast.success("Вес добавлен");
      setOpen(false);
    },
    onError: () => toast.error("Не удалось сохранить"),
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Вес</h1>
        <Button onClick={() => setOpen(true)}>Добавить</Button>
      </header>

      <WeightAnalytics babyId={babyId} tz={tz} />

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side={isMobile ? "bottom" : "right"}>
          <SheetHeader>
            <SheetTitle>Новое взвешивание</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 px-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="wdate">Дата</Label>
              <Input
                id="wdate"
                type="date"
                value={dateISO}
                onChange={(e) => setDateISO(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wgrams">Граммы</Label>
              <Input
                id="wgrams"
                type="number"
                min={1}
                max={50000}
                inputMode="numeric"
                value={grams}
                onChange={(e) => setGrams(Number(e.target.value))}
              />
            </div>
          </div>
          <SheetFooter className="gap-2">
            <SheetClose asChild>
              <Button variant="ghost">Отмена</Button>
            </SheetClose>
            <Button
              onClick={() => create.mutate()}
              disabled={create.isPending || grams <= 0}
            >
              Сохранить
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
