
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { H3, Muted } from "@/components/ui/typography";
import { babiesKey, archivedBabiesKey } from "@/components/day-view/feedingsKey";
import type { SerializedBaby } from "@leon/contracts/serialized";
import { getBrowserTz } from "@/lib/time/browserTz";
import { listBabies, restoreBaby } from "@/lib/api/babies";

type Props = {
  babies: SerializedBaby[];
  tz: string;
};

export function ArchivedBabyList({ babies: initialData, tz }: Props) {
  const effectiveTz = getBrowserTz(tz);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: archivedBabiesKey,
    queryFn: () => listBabies({ includeArchived: true }),
    initialData,
  });

  const restore = useMutation({
    mutationFn: (id: string) => restoreBaby(id),
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
      <H3>Архив детей</H3>
      {list.length === 0 ? (
        <Muted>Архив пуст.</Muted>
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
                  {formatInTimeZone(new Date(baby.birthDate), effectiveTz, "dd.MM.yyyy")}
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
