export const PALETTES = ["neutral", "blue", "green", "rose", "amber"] as const;
export type Palette = (typeof PALETTES)[number];

export const DEFAULT_PALETTE: Palette = "neutral";
export const PALETTE_STORAGE_KEY = "leon-palette";

export const PALETTE_LABELS: Record<Palette, string> = {
  neutral: "Нейтральная",
  blue: "Синяя",
  green: "Зелёная",
  rose: "Розовая",
  amber: "Янтарная",
};

export const PALETTE_SWATCH: Record<Palette, string> = {
  neutral: "oklch(0.205 0 0)",
  blue: "oklch(0.546 0.245 262.881)",
  green: "oklch(0.627 0.194 149.214)",
  rose: "oklch(0.645 0.246 16.439)",
  amber: "oklch(0.769 0.188 70.08)",
};

export function isPalette(v: unknown): v is Palette {
  return typeof v === "string" && (PALETTES as readonly string[]).includes(v);
}
