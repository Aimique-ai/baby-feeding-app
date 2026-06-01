import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_PALETTE,
  PALETTES,
  PALETTE_STORAGE_KEY,
  isPalette,
  type Palette,
} from "~/lib/palette";
import {
  AppearanceContext,
  type AppearanceContextValue,
  type ResolvedTheme,
  type ThemeIntent,
} from "./appearanceContext";

const THEME_KEY = "leon-theme";
const PALETTES_SET = new Set<string>(PALETTES);

function readSystemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function readStoredTheme(): ThemeIntent {
  if (typeof window === "undefined") return "system";
  try {
    const raw = window.localStorage.getItem(THEME_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    /* storage unavailable */
  }
  return "system";
}

function readStoredPalette(): Palette {
  if (typeof window === "undefined") return DEFAULT_PALETTE;
  try {
    const raw = window.localStorage.getItem(PALETTE_STORAGE_KEY);
    if (raw && PALETTES_SET.has(raw)) return raw as Palette;
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_PALETTE;
}

function applyTheme(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.setAttribute("data-theme", resolved);
}

function applyPalette(palette: Palette) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-palette", palette);
}

export function AppearanceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Lazy initializers read synchronously from localStorage / matchMedia on the
  // client (and fall back to defaults on the server). The pre-paint inline
  // script in root.tsx has already set the visible attributes; this just seeds
  // React state without an extra mount-time setState + cascading re-render.
  const [theme, setThemeState] = useState<ThemeIntent>(readStoredTheme);
  const [systemDark, setSystemDark] = useState(readSystemPrefersDark);
  const [palette, setPaletteState] = useState<Palette>(readStoredPalette);

  // Track OS dark-mode flips while the app is open.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) =>
      setSystemDark(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Cross-tab sync via storage events.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_KEY) {
        const v = event.newValue;
        if (v === "light" || v === "dark" || v === "system") setThemeState(v);
      }
      if (event.key === PALETTE_STORAGE_KEY) {
        if (isPalette(event.newValue)) setPaletteState(event.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const resolvedTheme: ResolvedTheme =
    theme === "system" ? (systemDark ? "dark" : "light") : theme;

  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    applyPalette(palette);
  }, [palette]);

  const setTheme = useCallback((next: ThemeIntent) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const setPalette = useCallback((next: Palette) => {
    setPaletteState(next);
    try {
      window.localStorage.setItem(PALETTE_STORAGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const value = useMemo<AppearanceContextValue>(
    () => ({ theme, resolvedTheme, setTheme, palette, setPalette }),
    [theme, resolvedTheme, setTheme, palette, setPalette],
  );

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}
