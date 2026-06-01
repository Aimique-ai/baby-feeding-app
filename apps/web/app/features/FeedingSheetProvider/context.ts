import { createContext, useContext } from "react";
import type { Feeding } from "@leon/schemas/feeding";

export type CreatePreset = {
  time?: Date;
  volumeMl?: number;
  startAt?: Date;
  durationMin?: number;
};

export type OpenCreate = (opts?: {
  dateISO?: string;
  preset?: CreatePreset;
}) => void;
export type OpenEdit = (opts: { feeding: Feeding; dateISO?: string }) => void;

export type FeedingSheetCtxValue = {
  openCreate: OpenCreate;
  openEdit: OpenEdit;
};

export const FeedingSheetCtx = createContext<FeedingSheetCtxValue | null>(null);

export function useFeedingSheet(): FeedingSheetCtxValue {
  const c = useContext(FeedingSheetCtx);
  if (!c)
    throw new Error("useFeedingSheet must be used inside FeedingSheetProvider");
  return c;
}

export function useFeedingSheetOptional(): FeedingSheetCtxValue | null {
  return useContext(FeedingSheetCtx);
}
