import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { makeQueryClient } from "@/lib/rq/queryClient";
import { H1 } from "@/components/ui/typography";
import { SkeletonClient } from "./SkeletonClient";
import { fetchSkeletonFeedings } from "./data";
import { SKELETON_QUERY_KEY } from "./types";

export const runtime = "nodejs";

export default async function SkeletonPage() {
  const queryClient = makeQueryClient();
  await queryClient.prefetchQuery({
    queryKey: SKELETON_QUERY_KEY,
    queryFn: fetchSkeletonFeedings,
  });

  return (
    <main className="p-8">
      <H1 className="mb-4">Walking skeleton</H1>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <SkeletonClient />
      </HydrationBoundary>
    </main>
  );
}
