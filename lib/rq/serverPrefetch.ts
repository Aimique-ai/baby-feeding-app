import { dehydrate, type QueryClient } from "@tanstack/react-query";
import { makeQueryClient } from "./queryClient";

/**
 * RSC prefetch helper. Use in Server Components:
 *
 *   const { state } = await prefetchOnServer(async (qc) => {
 *     await qc.prefetchQuery({ queryKey: ['feedings', dateISO], queryFn: ... });
 *   });
 *   return <HydrationBoundary state={state}><Client/></HydrationBoundary>;
 */
export async function prefetchOnServer(
  fill: (qc: QueryClient) => Promise<void> | void,
) {
  const qc = makeQueryClient();
  await fill(qc);
  return { state: dehydrate(qc) };
}
