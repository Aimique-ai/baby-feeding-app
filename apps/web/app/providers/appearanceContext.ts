import { createContext, useContext } from "react";
import type { Palette } from "~/lib/palette";

export type ThemeIntent = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export type AppearanceContextValue = {
  theme: ThemeIntent;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemeIntent) => void;
  palette: Palette;
  setPalette: (palette: Palette) => void;
};

export const AppearanceContext = createContext<AppearanceContextValue | null>(
  null,
);

export function useAppearance(): AppearanceContextValue {
  const value = useContext(AppearanceContext);
  if (!value) {
    throw new Error("useAppearance must be used inside AppearanceProvider");
  }
  return value;
}
