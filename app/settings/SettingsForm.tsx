"use client";

import { useEffect, useState } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { usePalette } from "@/components/PaletteProvider";
import {
  PALETTES,
  PALETTE_LABELS,
  PALETTE_SWATCH,
  type Palette,
} from "@/lib/palette";
import { Button } from "@/components/ui/button";

const MODES = [
  { value: "light", label: "Светлая", Icon: Sun },
  { value: "dark", label: "Тёмная", Icon: Moon },
  { value: "system", label: "Системная", Icon: Monitor },
] as const;

export function SettingsForm() {
  const { palette, setPalette } = usePalette();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-1 text-base font-medium">Палитра</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Основной цвет акцента в интерфейсе.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {PALETTES.map((p) => (
            <PaletteCard
              key={p}
              value={p}
              active={palette === p}
              onSelect={setPalette}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-base font-medium">Режим</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Светлая, тёмная или по системе.
        </p>
        <div className="flex flex-wrap gap-2">
          {MODES.map(({ value, label, Icon }) => {
            const active = mounted && theme === value;
            return (
              <Button
                key={value}
                type="button"
                variant={active ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme(value)}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function PaletteCard({
  value,
  active,
  onSelect,
}: {
  value: Palette;
  active: boolean;
  onSelect: (p: Palette) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      aria-pressed={active}
      className={`relative flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground ${
        active ? "border-primary ring-2 ring-ring/40" : "border-border"
      }`}
    >
      <span
        className="inline-block size-6 rounded-full border border-border/60"
        style={{ background: PALETTE_SWATCH[value] }}
        aria-hidden
      />
      <span className="text-sm font-medium">{PALETTE_LABELS[value]}</span>
      {active && (
        <Check
          className="ml-auto size-4 text-primary"
          aria-label="Выбрано"
        />
      )}
    </button>
  );
}
