import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from "~/components/ui/sidebar";
import { navItems } from "~/components/SideNav/navItems";
import { BabySwitcher } from "./BabySwitcher";
import { NavMain } from "./NavMain";

export function SideNav() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <BabySwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>
    </Sidebar>
  );
}
