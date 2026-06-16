import { Baby, ChevronsUpDown, Plus } from "lucide-react";
import { useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "~/components/ui/sidebar";
import { listBabies } from "~/lib/api/babies";
import { babiesKey } from "~/lib/queryKeys";
import { writeActiveBabyId } from "~/lib/baby/active";
import { useActiveBabyId } from "~/lib/baby/useActiveBaby";

export function BabySwitcher() {
  const { isMobile } = useSidebar();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const activeId = useActiveBabyId();

  const q = useQuery({ queryKey: babiesKey, queryFn: () => listBabies() });
  const list = q.data ?? [];
  const active = list.find((b) => b._id === activeId) ?? null;

  const switchMutation = useMutation({
    mutationFn: async (babyId: string) => {
      writeActiveBabyId(babyId);
      return { babyId };
    },
    onSuccess: () => {
      qc.removeQueries({ queryKey: ["baby"] });
      qc.removeQueries({ queryKey: ["feedings"] });
      qc.removeQueries({ queryKey: ["weights"] });
      qc.removeQueries({ queryKey: ["medications"] });
      qc.removeQueries({ queryKey: ["medication"] });
      qc.removeQueries({ queryKey: ["history"] });
      qc.invalidateQueries({ queryKey: babiesKey });
      navigate("/");
    },
    onError: () => toast.error("Не удалось переключить"),
  });

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Baby className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {active?.name ?? "Выбрать ребёнка"}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Дети
            </DropdownMenuLabel>
            {list.map((baby) => (
              <DropdownMenuItem
                key={baby._id}
                onClick={() => {
                  if (baby._id !== activeId) switchMutation.mutate(baby._id);
                }}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-md border">
                  <Baby className="size-3.5 shrink-0" />
                </div>
                {baby.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 p-2"
              onClick={() => navigate("/babies")}
            >
              <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                <Plus className="size-4" />
              </div>
              <div className="font-medium text-muted-foreground">Добавить</div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
