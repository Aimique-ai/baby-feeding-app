import { Outlet } from "react-router";
import { Toaster } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { SideNav } from "~/components/SideNav";
import { AppHeader } from "~/components/AppHeader";
import { FeedingSheetProvider } from "~/features/FeedingSheetProvider";
import { FeedingTimerProvider } from "~/features/FeedingTimerProvider";
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar";
import { FlickeringGrid } from "~/components/ui/flickering-grid";
import { listBabies } from "~/lib/api/babies";
import { babiesKey } from "~/lib/queryKeys";
import { useActiveBabyId } from "~/lib/baby/useActiveBaby";
import { getBrowserTz } from "~/lib/time/browserTz";

const GRID_COLOR = { male: "#60A5FA", female: "#F472B6" } as const;

export default function AppLayout() {
  const babyId = useActiveBabyId();
  const tz = getBrowserTz();

  const { data: babies } = useQuery({ queryKey: babiesKey, queryFn: () => listBabies() });
  const activeSex = babies?.find((b) => b._id === babyId)?.sex;
  const gridColor = activeSex === "female" ? GRID_COLOR.female : GRID_COLOR.male;

  return (
    <>
      <FeedingTimerProvider babyId={babyId}>
        <FeedingSheetProvider babyId={babyId} tz={tz}>
          <FlickeringGrid
            className="fixed inset-0 z-0 [mask-image:radial-gradient(900px_circle_at_top,white,transparent)]"
            squareSize={4}
            gridGap={6}
            color={gridColor}
            maxOpacity={0.3}
            flickerChance={0.1}
          />
          <SidebarProvider className="relative z-10 bg-transparent">
            <SideNav />
            <SidebarInset className="bg-transparent">
              <AppHeader babyId={babyId} />
              <div className="block w-full">
                <Outlet />
              </div>
            </SidebarInset>
          </SidebarProvider>
        </FeedingSheetProvider>
      </FeedingTimerProvider>
      <Toaster position="top-center" richColors theme="system" />
    </>
  );
}
