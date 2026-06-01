import { Outlet } from "react-router";
import { Toaster } from "sonner";
import { SideNav } from "~/components/SideNav";
import { AppHeader } from "~/components/AppHeader";
import { FeedingSheetProvider } from "~/features/FeedingSheetProvider";
import { FeedingTimerProvider } from "~/features/FeedingTimerProvider";
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar";
import { useActiveBabyId } from "~/lib/baby/useActiveBaby";
import { getBrowserTz } from "~/lib/time/browserTz";

export default function AppLayout() {
  const babyId = useActiveBabyId();
  const tz = getBrowserTz();

  return (
    <>
      <FeedingTimerProvider babyId={babyId}>
        <FeedingSheetProvider babyId={babyId} tz={tz}>
          <SidebarProvider>
            <SideNav />
            <SidebarInset>
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
