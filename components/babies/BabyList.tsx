"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BabyForm } from "./BabyForm";
import {
  babiesKey,
  archivedBabiesKey,
} from "@/components/day-view/feedingsKey";
import type { SerializedBaby } from "@/lib/api/serializedTypes";

async function fetchBabies(): Promise<SerializedBaby[]> {
  const r = await fetch("/api/babies", { cache: "no-store" });
  if (!r.ok) throw new Error("babies fetch failed");
  return r.json();
}

type Props = {
  babies: SerializedBaby[];
  activeBabyId: string | null;
};

export function BabyList({ babies: initialData, activeBabyId }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const q = useQuery({
    queryKey: babiesKey,
    queryFn: fetchBabies,
    initialData,
  });

  const createMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      birthDate: string;
      birthWeightGrams: number;
      feedingsPerDay: number;
    }) => {
      const r = await fetch("/api/babies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (r.status === 409) {
        throw new Error("duplicate_name");
      }
      if (!r.ok) throw new Error(await r.text());
      return r.json() as Promise<SerializedBaby>;
    },
    onSuccess: async (created) => {
      await fetch("/api/babies/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ babyId: created._id }),
      });
      qc.removeQueries({ queryKey: ["baby"] });
      qc.removeQueries({ queryKey: ["feedings"] });
      qc.removeQueries({ queryKey: ["weights"] });
      qc.removeQueries({ queryKey: ["medications"] });
      qc.invalidateQueries({ queryKey: babiesKey });
      setCreateOpen(false);
      toast.success("Ребёнок создан");
      router.refresh();
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
      const r = await fetch("/api/babies/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ babyId }),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      qc.removeQueries({ queryKey: ["baby"] });
      qc.removeQueries({ queryKey: ["feedings"] });
      qc.removeQueries({ queryKey: ["weights"] });
      qc.removeQueries({ queryKey: ["medications"] });
      router.refresh();
    },
    onError: () => toast.error("Не удалось переключить"),
  });

  const archiveMutation = useMutation({
    mutationFn: async (babyId: string) => {
      const r = await fetch(`/api/babies/${babyId}`, { method: "DELETE" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: (_data, babyId) => {
      qc.invalidateQueries({ queryKey: babiesKey });
      qc.invalidateQueries({ queryKey: archivedBabiesKey });
      toast.success("Архивирован");
      if (babyId === activeBabyId) {
        router.refresh();
      }
    },
    onError: () => toast.error("Не удалось архивировать"),
  });

  const list = q.data ?? [];

  return (
    <div className="mx-auto max-w-screen-sm px-4 py-4 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Дети</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/babies/archive"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Архив →
          </Link>
          <Button onClick={() => { setCreateError(null); setCreateOpen(true); }}>
            + Создать
          </Button>
        </div>
      </header>

      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-12">
          <p className="text-sm text-muted-foreground">Нет детей.</p>
          <Button size="lg" onClick={() => { setCreateError(null); setCreateOpen(true); }}>
            Создать ребёнка
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map((baby) => {
            const isActive = baby._id === activeBabyId;
            const birthMs = new Date(baby.birthDate).getTime();
            const nowMs = new Date().getTime();
            const dol = Math.floor((nowMs - birthMs) / (24 * 3600 * 1000));
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
                    {new Date(baby.birthDate).toLocaleDateString("ru-RU")} · день {dol}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {!isActive && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => switchMutation.mutate(baby._id)}
                      disabled={switchMutation.isPending}
                    >
                      Выбрать
                    </Button>
                  )}
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
            onSubmit={(data) => createMutation.mutate(data)}
            isPending={createMutation.isPending}
            submitError={createError}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
