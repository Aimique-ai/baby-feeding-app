"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useFeedingSheet } from "@/components/feeding-sheet/FeedingSheetProvider";

type Props = {
  hasActiveBaby: boolean;
};

export function AppHeader({ hasActiveBaby }: Props) {
  const { openCreate } = useFeedingSheet();
  return (
    <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur">
      <SidebarTrigger className="md:hidden" />
      <span className="text-sm font-medium">Leon</span>
      <div className="ml-auto">
        {hasActiveBaby && (
          <Button
            size="sm"
            onClick={() => openCreate()}
            aria-label="Новое кормление"
          >
            <Plus className="size-4" aria-hidden />
            <span className="hidden sm:inline">Кормление</span>
          </Button>
        )}
      </div>
    </header>
  );
}
