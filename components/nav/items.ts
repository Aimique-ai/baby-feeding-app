import { Baby, Calendar, Home, Pill, Scale, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
  Icon: LucideIcon;
};

export const navItems: NavItem[] = [
  {
    href: "/",
    label: "Сегодня",
    match: (p) => p === "/",
    Icon: Home,
  },
  {
    href: "/history",
    label: "История",
    match: (p) => p.startsWith("/history"),
    Icon: Calendar,
  },
  {
    href: "/weight",
    label: "Вес",
    match: (p) => p.startsWith("/weight"),
    Icon: Scale,
  },
  {
    href: "/medications",
    label: "Лекарства",
    match: (p) => p.startsWith("/medications"),
    Icon: Pill,
  },
  {
    href: "/babies",
    label: "Дети",
    match: (p) => p.startsWith("/babies"),
    Icon: Baby,
  },
  {
    href: "/settings",
    label: "Настройки",
    match: (p) => p.startsWith("/settings"),
    Icon: Settings,
  },
];
