import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_PALETTE,
  PALETTES,
  PALETTE_STORAGE_KEY,
  isPalette,
  type Palette,
} from "~/lib/palette";

type ThemeIntent = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

const THEME_KEY = "leon-theme";
const PALETTES_SET = new Set<string>(PALETTES);

type AppearanceContextValue = {
  theme: ThemeIntent;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemeIntent) => void;
  palette: Palette;
  setPalette: (palette: Palette) => void;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

function readSystemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
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
  const [theme, setThemeState] = useState<ThemeIntent>("system");
  const [systemDark, setSystemDark] = useState(false);
  const [palette, setPaletteState] = useState<Palette>(DEFAULT_PALETTE);

  // Initial read from localStorage on mount. The pre-paint inline script in
  // root.tsx has already set the visible attributes; this just syncs React state.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(THEME_KEY);
      if (raw === "light" || raw === "dark" || raw === "system") {
        setThemeState(raw);
      }
      const rawPalette = window.localStorage.getItem(PALETTE_STORAGE_KEY);
      if (rawPalette && PALETTES_SET.has(rawPalette)) {
        setPaletteState(rawPalette as Palette);
      }
    } catch {
      /* storage unavailable */
    }
    setSystemDark(readSystemPrefersDark());
  }, []);

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

export function useAppearance(): AppearanceContextValue {
  const value = useContext(AppearanceContext);
  if (!value) {
    throw new Error("useAppearance must be used inside AppearanceProvider");
  }
  return value;
}
