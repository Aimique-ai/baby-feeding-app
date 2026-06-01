import { createContext, useContext } from "react";
import type { FeedingTimer } from "./useFeedingTimer";

export const FeedingTimerCtx = createContext<FeedingTimer | null>(null);

export function useFeedingTimerCtx(): FeedingTimer {
  const v = useContext(FeedingTimerCtx);
  if (!v)
    throw new Error(
      "useFeedingTimerCtx must be used inside FeedingTimerProvider",
    );
  return v;
}

export function useFeedingTimerOptional(): FeedingTimer | null {
  return useContext(FeedingTimerCtx);
}
