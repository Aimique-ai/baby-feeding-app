"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { babiesKey, archivedBabiesKey } from "@/components/day-view/feedingsKey";
import type { SerializedBaby } from "@/lib/api/serializedTypes";

async function fetchArchivedBabies(): Promise<SerializedBaby[]> {
  const r = await fetch("/api/babies?includeArchived=true", {
    cache: "no-store",
  });
  if (!r.ok) throw new Error("babies fetch failed");
  return r.json();
}

type Props = {
  babies: SerializedBaby[];
};

export function ArchivedBabyList({ babies: initialData }: Props) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: archivedBabiesKey,
    queryFn: fetchArchivedBabies,
    initialData,
  });

  const restore = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/babies/${id}/restore`, { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: babiesKey });
      qc.invalidateQueries({ queryKey: archivedBabiesKey });
      toast.success("Восстановлен");
    },
    onError: () => toast.error("Не удалось восстановить"),
  });

  const list = q.data ?? [];

  return (
    <div className="mx-auto max-w-screen-sm px-4 py-4 space-y-4">
      <h1 className="text-lg font-semibold">Архив детей</h1>
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">Архив пуст.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((baby) => (
            <li
              key={baby._id}
              className="flex items-center justify-between rounded border px-3 py-2"
            >
              <div>
                <p className="font-medium">{baby.name}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(baby.birthDate).toLocaleDateString("ru-RU")}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => restore.mutate(baby._id)}
                disabled={restore.isPending}
              >
                Восстановить
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
