import { HistoryList } from "@/components/history/HistoryList";
import { HistoryTabs } from "@/components/history/HistoryTabs";
import { getBrowserTz } from "~/lib/time/browserTz";

export function meta() {
  return [{ title: "История — Leon" }];
}

export default function HistoryPage() {
  const tz = getBrowserTz();
  return (
    <div className="mx-auto max-w-screen-sm px-4 py-4">
      <HistoryTabs />
      <HistoryList tz={tz} />
    </div>
  );
}
