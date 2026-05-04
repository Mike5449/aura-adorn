import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark";

interface ThemeCtx {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx | null>(null);
const STORAGE_KEY = "maison_theme";

/**
 * Read the user's preferred theme.
 *
 * Order of preference: explicit choice in localStorage → "light" (the
 * white/red palette is now the canonical default).
 *
 * We deliberately do NOT honour `prefers-color-scheme` — most visitors
 * have system-level dark mode and would land on the dark theme without
 * realising the brand has a light variant. Defaulting to light forces
 * everyone to see the canonical brand at least once; the toggle lets
 * dark-mode lovers switch with one click.
 */
function readInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    /* private mode / storage disabled */
  }
  return "light";
}

function applyThemeToDocument(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // SSR-safe: start as "light" on the server, sync from storage on mount.
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const initial = readInitialTheme();
    setThemeState(initial);
    applyThemeToDocument(initial);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    applyThemeToDocument(t);
    try {
      window.localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  const value = useMemo<ThemeCtx>(
    () => ({ theme, setTheme, toggle }),
    [theme, setTheme, toggle],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
