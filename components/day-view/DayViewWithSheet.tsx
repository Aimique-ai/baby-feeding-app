"use client";

import { useQueryClient } from "@tanstack/react-query";
import { DayView } from "./DayView";
import { feedingsKey } from "./feedingsKey";
import { useFeedingSheet } from "@/components/feeding-sheet/FeedingSheetProvider";
import type { SerializedFeeding } from "@/lib/api/serializedTypes";
import { getBrowserTz } from "@/lib/time/browserTz";

type Props = {
  mode: "live" | "historical";
  dateISO: string;
  tz: string;
  babyId: string;
  prevDayAnchor: string | null;
};

export function DayViewWithSheet(props: Props) {
  const qc = useQueryClient();
  const { openCreate, openEdit } = useFeedingSheet();
  const effectiveTz = getBrowserTz(props.tz);

  return (
    <DayView
      {...props}
      onAddFeeding={(preset) =>
        openCreate({ dateISO: props.dateISO, preset })
      }
      onEditFeeding={(feedingId) => {
        const list = qc.getQueryData<SerializedFeeding[]>(
          feedingsKey(props.babyId, props.dateISO, effectiveTz),
        );
        const feeding = list?.find((f) => f._id === feedingId);
        if (!feeding) return;
        openEdit({ feeding, dateISO: props.dateISO });
      }}
    />
  );
}
