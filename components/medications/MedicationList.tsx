"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { MedicationSheet } from "./MedicationSheet";
import type { SerializedMedication } from "@/lib/api/serializedTypes";
import { medicationsKey } from "@/components/day-view/feedingsKey";

async function fetchMedications(): Promise<SerializedMedication[]> {
  const r = await fetch("/api/medications", { cache: "no-store" });
  if (!r.ok) throw new Error("medications fetch failed");
  return r.json();
}

type SheetState =
  | null
  | { kind: "create" }
  | { kind: "edit"; medication: SerializedMedication };

export function MedicationList({ babyId }: { babyId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: medicationsKey(babyId),
    queryFn: fetchMedications,
  });
  const [sheet, setSheet] = useState<SheetState>(null);
  const [confirmDelete, setConfirmDelete] =
    useState<SerializedMedication | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/medications/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: medicationsKey(babyId) });
      toast.success("Удалено");
      setConfirmDelete(null);
    },
    onError: () => toast.error("Не удалось удалить"),
  });

  return (
    <div className="mx-auto max-w-screen-sm px-4 py-4 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Лекарства</h1>
        <Button onClick={() => setSheet({ kind: "create" })}>Добавить</Button>
      </header>
      <ul className="space-y-1">
        {(q.data ?? []).map((m) => (
          <li
            key={m._id}
            className="flex items-center justify-between rounded border px-3 py-2 text-sm"
          >
            <div className="flex flex-col">
              <span className="font-medium">{m.name}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {m.defaultDoseDrops} капель
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                aria-label="Редактировать"
                onClick={() => setSheet({ kind: "edit", medication: m })}
              >
                <Pencil className="size-4" aria-hidden />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label="Удалить"
                onClick={() => setConfirmDelete(m)}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>
          </li>
        ))}
        {(q.data?.length ?? 0) === 0 && (
          <li className="text-sm text-muted-foreground">Список пуст.</li>
        )}
      </ul>

      <MedicationSheet
        state={sheet}
        onOpenChange={(open) => {
          if (!open) setSheet(null);
        }}
        babyId={babyId}
      />

      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => {
          if (!o) setConfirmDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить лекарство?</AlertDialogTitle>
            <AlertDialogDescription>
              Записи в истории сохранятся.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (confirmDelete) deleteMutation.mutate(confirmDelete._id);
              }}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
