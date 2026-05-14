"use client";

import * as React from "react";
import { FeedingSheet } from "./FeedingSheet";
import { localDateISO } from "@/lib/planning/dayBoundary";
import type { SerializedFeeding } from "@/lib/api/serializedTypes";

type CreatePreset = {
  time?: Date;
  volumeMl?: number;
};

type OpenCreate = (opts?: { dateISO?: string; preset?: CreatePreset }) => void;
type OpenEdit = (opts: { feeding: SerializedFeeding; dateISO?: string }) => void;

type Ctx = {
  openCreate: OpenCreate;
  openEdit: OpenEdit;
};

const FeedingSheetCtx = React.createContext<Ctx | null>(null);

type SheetState =
  | { kind: "create"; dateISO: string; preset?: CreatePreset }
  | { kind: "edit"; dateISO: string; feeding: SerializedFeeding };

type Props = {
  babyId: string | null;
  tz: string;
  children: React.ReactNode;
};

export function FeedingSheetProvider({ babyId, tz, children }: Props) {
  const [open, setOpen] = React.useState(false);
  const [state, setState] = React.useState<SheetState | null>(null);
  const [sheetKey, setSheetKey] = React.useState(0);

  const openCreate = React.useCallback<OpenCreate>(
    (opts) => {
      if (!babyId) return;
      setState({
        kind: "create",
        dateISO: opts?.dateISO ?? localDateISO(new Date(), tz),
        preset: opts?.preset,
      });
      setSheetKey((k) => k + 1);
      setOpen(true);
    },
    [babyId, tz],
  );

  const openEdit = React.useCallback<OpenEdit>(
    (opts) => {
      if (!babyId) return;
      setState({
        kind: "edit",
        dateISO: opts.dateISO ?? localDateISO(new Date(opts.feeding.startAt), tz),
        feeding: opts.feeding,
      });
      setSheetKey((k) => k + 1);
      setOpen(true);
    },
    [babyId, tz],
  );

  const ctx = React.useMemo<Ctx>(
    () => ({ openCreate, openEdit }),
    [openCreate, openEdit],
  );

  return (
    <FeedingSheetCtx.Provider value={ctx}>
      {children}
      {babyId && state && (
        <FeedingSheet
          key={sheetKey}
          open={open}
          onOpenChange={setOpen}
          mode={
            state.kind === "create"
              ? { kind: "create", preset: state.preset }
              : { kind: "edit", feeding: state.feeding }
          }
          dateISO={state.dateISO}
          tz={tz}
          babyId={babyId}
        />
      )}
    </FeedingSheetCtx.Provider>
  );
}

export function useFeedingSheet(): Ctx {
  const c = React.useContext(FeedingSheetCtx);
  if (!c) throw new Error("useFeedingSheet must be used inside FeedingSheetProvider");
  return c;
}

export function useFeedingSheetOptional(): Ctx | null {
  return React.useContext(FeedingSheetCtx);
}
