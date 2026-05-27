import { http } from "~/lib/http/client";
import { readActiveBabyId } from "./active";

/**
 * Returns the active baby id, bootstrapping from server fallback if localStorage
 * is empty. The server's `activeBaby` middleware resolves the first non-archived
 * baby when `x-active-baby-id` is absent and echoes `X-Active-Baby-Id` back; the
 * axios interceptor persists that to localStorage. So a single GET /api/baby
 * "primes" localStorage on cold start.
 *
 * Returns null if even the server fallback fails (no babies at all → 412).
 */
export async function ensureActiveBabyId(): Promise<string | null> {
  const cached = readActiveBabyId();
  if (cached) return cached;
  try {
    await http.get("/api/baby");
  } catch {
    return null;
  }
  return readActiveBabyId();
}
