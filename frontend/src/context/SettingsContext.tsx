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
  exchangeRate: number;            // HTG per 1 USD
  deliveryFeeHtg: number;          // flat HTG fee when delivery is requested
  freeDeliveryThresholdHtg: number; // subtotal HTG above which delivery is free
  loading: boolean;
  refresh: () => Promise<void>;
  setExchangeRateValue: (rate: number) => void;
  setDeliveryFeeValue: (fee: number) => void;
  setFreeDeliveryThresholdValue: (t: number) => void;
}

const Ctx = createContext<SettingsCtx | null>(null);

// Fallbacks used while we wait for the public settings endpoint to respond,
// or when it errors out. They mirror the historical hard-coded constants.
const FALLBACK_RATE = 130;
const FALLBACK_DELIVERY = 150;
const FALLBACK_FREE_THRESHOLD = 2500;

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [exchangeRate, setExchangeRate] = useState<number>(FALLBACK_RATE);
  const [deliveryFeeHtg, setDeliveryFee] = useState<number>(FALLBACK_DELIVERY);
  const [freeDeliveryThresholdHtg, setFreeThreshold] = useState<number>(FALLBACK_FREE_THRESHOLD);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const s = await settingsApi.getPublic();
      const rate = Number(s.exchange_rate_htg_per_usd);
      const fee = Number(s.delivery_fee_htg);
      const threshold = Number(s.free_delivery_threshold_htg);
      if (Number.isFinite(rate) && rate > 0) setExchangeRate(rate);
      if (Number.isFinite(fee) && fee >= 0) setDeliveryFee(fee);
      if (Number.isFinite(threshold) && threshold >= 0) setFreeThreshold(threshold);
    } catch {
      // keep fallbacks
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const value = useMemo<SettingsCtx>(
    () => ({
      exchangeRate,
      deliveryFeeHtg,
      freeDeliveryThresholdHtg,
      loading,
      refresh,
      setExchangeRateValue: setExchangeRate,
      setDeliveryFeeValue: setDeliveryFee,
      setFreeDeliveryThresholdValue: setFreeThreshold,
    }),
    [exchangeRate, deliveryFeeHtg, freeDeliveryThresholdHtg, loading, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
