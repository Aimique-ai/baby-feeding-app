import { useQueryClient } from "@tanstack/react-query";
import { DayView } from "~/features/DayView";
import { feedingsKey } from "~/lib/queryKeys";
import { useFeedingSheet } from "~/features/FeedingSheetProvider";
import type { Feeding } from "@leon/schemas/feeding";
import { getBrowserTz } from "~/lib/time/browserTz";

type Props = {
  mode: "live" | "historical";
  dateISO: string;
  tz: string;
  babyId: string;
};

export function DayViewWithSheet(props: Props) {
  const qc = useQueryClient();
  const { openCreate, openEdit } = useFeedingSheet();
  const effectiveTz = getBrowserTz(props.tz);

  return (
    <DayView
      {...props}
      onAddFeeding={(preset) => openCreate({ dateISO: props.dateISO, preset })}
      onEditFeeding={(feedingId) => {
        const list = qc.getQueryData<Feeding[]>(
          feedingsKey(props.babyId, props.dateISO, effectiveTz),
        );
        const feeding = list?.find((f) => f._id === feedingId);
        if (!feeding) return;
        openEdit({ feeding, dateISO: props.dateISO });
      }}
    />
  );
}
