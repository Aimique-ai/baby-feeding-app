import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppearance } from "~/providers/AppearanceProvider";

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useAppearance();
  const isDark = resolvedTheme === "dark";

  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Светлая тема" : "Тёмная тема"}
    >
      <Sun
        className="size-4 scale-100 dark:scale-0 transition-transform"
        aria-hidden
      />
      <Moon
        className="absolute size-4 scale-0 dark:scale-100 transition-transform"
        aria-hidden
      />
    </Button>
  );
}
