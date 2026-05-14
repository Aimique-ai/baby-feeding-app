"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { navItems } from "@/components/nav/items";

export function SideNav() {
  const pathname = usePathname();
  return (
    <Sidebar>
      <SidebarHeader>
        <div className="px-2 py-1 text-lg font-semibold tracking-tight">
          Leon
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((t) => {
                const active = t.match(pathname);
                return (
                  <SidebarMenuItem key={t.href}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link href={t.href}>
                        <t.Icon aria-hidden />
                        <span>{t.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
