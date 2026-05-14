"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_PALETTE,
  PALETTE_STORAGE_KEY,
  isPalette,
  type Palette,
} from "@/lib/palette";

type Ctx = {
  palette: Palette;
  setPalette: (p: Palette) => void;
};

const PaletteContext = createContext<Ctx | null>(null);

function applyPaletteAttr(p: Palette) {
  document.documentElement.dataset.palette = p;
}

export function PaletteProvider({ children }: { children: ReactNode }) {
  const [palette, setPaletteState] = useState<Palette>(DEFAULT_PALETTE);

  useEffect(() => {
    let p: Palette = DEFAULT_PALETTE;
    try {
      const stored = localStorage.getItem(PALETTE_STORAGE_KEY);
      if (isPalette(stored)) p = stored;
    } catch {}
    applyPaletteAttr(p);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPaletteState(p);
  }, []);

  const setPalette = useCallback((p: Palette) => {
    setPaletteState(p);
    applyPaletteAttr(p);
    try {
      localStorage.setItem(PALETTE_STORAGE_KEY, p);
    } catch {}
  }, []);

  return (
    <PaletteContext.Provider value={{ palette, setPalette }}>
      {children}
    </PaletteContext.Provider>
  );
}

export function usePalette() {
  const ctx = useContext(PaletteContext);
  if (!ctx) throw new Error("usePalette must be used inside <PaletteProvider>");
  return ctx;
}
