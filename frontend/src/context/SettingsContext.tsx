import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { settingsApi } from "@/lib/api";

interface SettingsCtx {
  exchangeRate: number;          // HTG per 1 USD
  loading: boolean;
  refresh: () => Promise<void>;
  setExchangeRateValue: (rate: number) => void; // optimistic local update after a save
}

const Ctx = createContext<SettingsCtx | null>(null);

const FALLBACK_RATE = 130;

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [exchangeRate, setExchangeRate] = useState<number>(FALLBACK_RATE);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const s = await settingsApi.getPublic();
      const n = Number(s.exchange_rate_htg_per_usd);
      if (Number.isFinite(n) && n > 0) setExchangeRate(n);
    } catch {
      // keep fallback
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const value = useMemo<SettingsCtx>(
    () => ({
      exchangeRate,
      loading,
      refresh,
      setExchangeRateValue: setExchangeRate,
    }),
    [exchangeRate, loading, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
