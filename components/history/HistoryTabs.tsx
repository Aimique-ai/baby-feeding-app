"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/history", label: "История" },
  { href: "/history/analytics", label: "Аналитика" },
] as const;

export function HistoryTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Разделы истории"
      className="inline-flex h-9 w-fit items-center justify-center gap-1 rounded-lg bg-muted p-[3px] text-muted-foreground"
    >
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            prefetch={false}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-full items-center justify-center rounded-md border border-transparent px-3 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all hover:text-foreground",
              active &&
                "bg-background text-foreground shadow-sm dark:border-input dark:bg-input/30",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
