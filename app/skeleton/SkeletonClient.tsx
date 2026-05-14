"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { SKELETON_QUERY_KEY, type SkeletonFeeding } from "./types";

async function fetchClient(): Promise<SkeletonFeeding[]> {
  const res = await fetch("/api/skeleton/echo", { cache: "no-store" });
  if (!res.ok) throw new Error("fetch failed");
  return res.json();
}

async function postEcho(volumeMl: number): Promise<SkeletonFeeding> {
  const res = await fetch("/api/skeleton/echo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ volumeMl }),
  });
  if (!res.ok) throw new Error("post failed");
  return res.json();
}

export function SkeletonClient() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: SKELETON_QUERY_KEY,
    queryFn: fetchClient,
  });

  const mutation = useMutation({
    mutationFn: () => postEcho(85),
    onSuccess: () => qc.invalidateQueries({ queryKey: SKELETON_QUERY_KEY }),
  });

  return (
    <div className="space-y-4">
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
    </div>
  );
}
