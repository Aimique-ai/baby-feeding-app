import { Check, Monitor, Moon, Sun } from "lucide-react";
import { Button } from "~/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { H4, Muted } from "~/components/ui/typography";
import { useAppearance } from "~/providers/appearanceContext";
import {
  PALETTES,
  PALETTE_LABELS,
  PALETTE_SWATCH,
  type Palette,
} from "~/lib/palette";

export function meta() {
  return [{ title: "Настройки — Leon" }];
}

const MODES = [
  { value: "light", label: "Светлая", Icon: Sun },
  { value: "dark", label: "Тёмная", Icon: Moon },
  { value: "system", label: "Системная", Icon: Monitor },
] as const;

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <SettingsForm />
    </div>
  );
}

function SettingsForm() {
  const { palette, setPalette, theme, setTheme } = useAppearance();

  return (
    <div className="space-y-10">
      <section>
        <H4 className="mb-1">Палитра</H4>
        <Muted className="mb-4">Основной цвет акцента в интерфейсе.</Muted>
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
        <H4 className="mb-1">Режим</H4>
        <Muted className="mb-4">Светлая, тёмная или по системе.</Muted>
        <ToggleGroup
          type="single"
          variant="outline"
          value={theme}
          onValueChange={(v) => {
            if (v) setTheme(v as typeof theme);
          }}
        >
          {MODES.map(({ value, label, Icon }) => (
            <ToggleGroupItem key={value} value={value}>
              <Icon className="size-4" aria-hidden />
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
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
    <Button
      variant="outline"
      onClick={() => onSelect(value)}
      aria-pressed={active}
      className={`h-auto w-full justify-start gap-3 p-3 text-left font-normal ${
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
        <Check className="ml-auto size-4 text-primary" aria-label="Выбрано" />
      )}
    </Button>
  );
}
