import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { H1 } from "@/components/ui/typography";
import { http } from "~/lib/http/client";

export function meta() {
  return [{ title: "Skeleton — Leon" }];
}

type SkeletonFeeding = {
  id: string;
  startAt: string;
  volumeMl: number;
};

const SKELETON_QUERY_KEY = ["feedings", "skeleton"] as const;

async function fetchFeedings(): Promise<SkeletonFeeding[]> {
  const r = await http.get<SkeletonFeeding[]>("/api/skeleton/echo");
  return r.data;
}

async function postEcho(volumeMl: number): Promise<SkeletonFeeding> {
  const r = await http.post<SkeletonFeeding>("/api/skeleton/echo", { volumeMl });
  return r.data;
}

export default function SkeletonPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: SKELETON_QUERY_KEY,
    queryFn: fetchFeedings,
  });
  const mutation = useMutation({
    mutationFn: () => postEcho(85),
    onSuccess: () => qc.invalidateQueries({ queryKey: SKELETON_QUERY_KEY }),
  });

  return (
    <main className="p-8">
      <H1 className="mb-4">Walking skeleton</H1>
      <ul className="space-y-1">
        {(data ?? []).map((f) => (
          <li key={f.id} className="text-sm">
            {f.startAt} — {f.volumeMl} ml
          </li>
        ))}
      </ul>
      <Button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? "Posting..." : "Post echo"}
      </Button>
    </main>
  );
}
