import { Baby, Calendar, Home, Pill, Scale, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavSubItem = {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
};

export type NavItem = {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
  Icon: LucideIcon;
  items?: NavSubItem[];
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
    items: [
      {
        href: "/history",
        label: "Обзор",
        match: (p) => p === "/history",
      },
      {
        href: "/history/analytics",
        label: "Аналитика",
        match: (p) => p === "/history/analytics",
      },
    ],
  },
  {
    href: "/weight",
    label: "Вес",
    match: (p) => p.startsWith("/weight"),
    Icon: Scale,
    items: [
      {
        href: "/weight",
        label: "Обзор",
        match: (p) => p === "/weight",
      },
      {
        href: "/weight/analytics",
        label: "Аналитика",
        match: (p) => p === "/weight/analytics",
      },
    ],
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
