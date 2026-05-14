"use client";

import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SerializedMedication } from "@/lib/api/serializedTypes";
import { medicationsKey } from "@/components/day-view/feedingsKey";
import { useIsMobile } from "@/hooks/use-mobile";

type State =
  | null
  | { kind: "create" }
  | { kind: "edit"; medication: SerializedMedication };

type Props = {
  state: State;
  onOpenChange: (open: boolean) => void;
  babyId: string;
};

export function MedicationSheet({ state, onOpenChange, babyId }: Props) {
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const editing = state?.kind === "edit" ? state.medication : null;

  const derivedName = editing?.name ?? "";
  const derivedDose = editing?.defaultDoseDrops ?? 1;

  const [name, setName] = useState(derivedName);
  const [dose, setDose] = useState<number>(derivedDose);
  const [lastStateKey, setLastStateKey] = useState<string>("null");

  const stateKey =
    state === null
      ? "null"
      : state.kind === "edit"
        ? state.medication._id
        : "create";

  if (stateKey !== lastStateKey) {
    setLastStateKey(stateKey);
    setName(derivedName);
    setDose(derivedDose);
  }

  const create = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/medications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), defaultDoseDrops: dose }),
      });
      if (r.status === 409) {
        const data = (await r.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "conflict");
      }
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: medicationsKey(babyId) });
      toast.success("Сохранено");
      onOpenChange(false);
    },
    onError: (e: Error) => {
      if (e.message === "duplicate_name") {
        toast.error("Уже существует");
      } else {
        toast.error("Не удалось сохранить");
      }
    },
  });

  const patch = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error("not edit");
      const r = await fetch(`/api/medications/${editing._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), defaultDoseDrops: dose }),
      });
      if (r.status === 409) {
        const data = (await r.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "conflict");
      }
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: medicationsKey(babyId) });
      toast.success("Сохранено");
      onOpenChange(false);
    },
    onError: (e: Error) => {
      if (e.message === "duplicate_name") {
        toast.error("Уже существует");
      } else {
        toast.error("Не удалось сохранить");
      }
    },
  });

  const isPending = create.isPending || patch.isPending;
  const trimmedName = name.trim();
  const invalid =
    trimmedName.length < 1 ||
    trimmedName.length > 50 ||
    !Number.isInteger(dose) ||
    dose < 1 ||
    dose > 100;

  function submit() {
    if (editing) patch.mutate();
    else create.mutate();
  }

  return (
    <Sheet open={state !== null} onOpenChange={onOpenChange}>
      <SheetContent side={isMobile ? "bottom" : "right"}>
        <SheetHeader>
          <SheetTitle>
            {editing ? "Редактировать лекарство" : "Новое лекарство"}
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-4 px-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="medname">Название</Label>
            <Input
              id="medname"
              type="text"
              maxLength={50}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="meddose">Доза, капель</Label>
            <Input
              id="meddose"
              type="number"
              min={1}
              max={100}
              inputMode="numeric"
              value={dose}
              onChange={(e) => setDose(Number(e.target.value))}
            />
          </div>
        </div>
        <SheetFooter className="gap-2">
          <SheetClose asChild>
            <Button variant="ghost" disabled={isPending}>
              Отмена
            </Button>
          </SheetClose>
          <Button onClick={submit} disabled={invalid || isPending}>
            Сохранить
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
