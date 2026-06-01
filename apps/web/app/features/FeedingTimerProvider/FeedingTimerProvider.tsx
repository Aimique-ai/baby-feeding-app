import * as React from "react";
import { useFeedingTimer } from "./useFeedingTimer";
import { FeedingTimerCtx } from "./context";

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
