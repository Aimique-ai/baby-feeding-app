"use client";

import * as React from "react";
import { useFeedingTimer, type FeedingTimer } from "@/hooks/useFeedingTimer";

const FeedingTimerCtx = React.createContext<FeedingTimer | null>(null);

type Props = {
  babyId: string | null;
  children: React.ReactNode;
};

export function FeedingTimerProvider({ babyId, children }: Props) {
  const timer = useFeedingTimer(babyId);
  return (
    <FeedingTimerCtx.Provider value={timer}>
      {children}
    </FeedingTimerCtx.Provider>
  );
}

export function useFeedingTimerCtx(): FeedingTimer {
  const v = React.useContext(FeedingTimerCtx);
  if (!v)
    throw new Error(
      "useFeedingTimerCtx must be used inside FeedingTimerProvider",
    );
  return v;
}

export function useFeedingTimerOptional(): FeedingTimer | null {
  return React.useContext(FeedingTimerCtx);
}
