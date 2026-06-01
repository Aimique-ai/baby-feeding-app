import { Link, useLocation } from "react-router";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";

const TABS = [
  { href: "/history", label: "История" },
  { href: "/history/analytics", label: "Аналитика" },
] as const;

export function HistoryTabs() {
  const pathname = useLocation().pathname;

  return (
    <Tabs value={pathname}>
      <TabsList aria-label="Разделы истории">
        {TABS.map((t) => (
          <TabsTrigger key={t.href} value={t.href} asChild>
            <Link to={t.href} prefetch="none">
              {t.label}
            </Link>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
