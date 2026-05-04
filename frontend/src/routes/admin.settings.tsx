import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Save, DollarSign, Truck } from "lucide-react";
import { settingsApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettings,
});

function AdminSettings() {
  const { isSuperAdmin, loading: authLoading } = useAuth();
  const {
    exchangeRate,
    deliveryFeeHtg,
    freeDeliveryThresholdHtg,
    setExchangeRateValue,
    setDeliveryFeeValue,
    setFreeDeliveryThresholdValue,
    refresh,
  } = useSettings();
  const navigate = useNavigate();

  const [rate, setRate] = useState<string>(String(exchangeRate));
  const [fee, setFee] = useState<string>(String(deliveryFeeHtg));
  const [threshold, setThreshold] = useState<string>(String(freeDeliveryThresholdHtg));
  const [savingRate, setSavingRate] = useState(false);
  const [savingDelivery, setSavingDelivery] = useState(false);

  useEffect(() => {
    if (!authLoading && !isSuperAdmin) {
      toast.error("Accès réservé au super_admin");
      navigate({ to: "/admin" });
    }
  }, [authLoading, isSuperAdmin, navigate]);

  useEffect(() => { setRate(String(exchangeRate)); }, [exchangeRate]);
  useEffect(() => { setFee(String(deliveryFeeHtg)); }, [deliveryFeeHtg]);
  useEffect(() => { setThreshold(String(freeDeliveryThresholdHtg)); }, [freeDeliveryThresholdHtg]);

  const saveRate = async () => {
    const n = Number(rate);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Le taux doit être un nombre positif");
      return;
    }
    setSavingRate(true);
    try {
      const updated = await settingsApi.updateExchangeRate(n);
      const newRate = Number(updated.exchange_rate_htg_per_usd);
      setExchangeRateValue(newRate);
      await refresh();
      toast.success(`Taux mis à jour : 1 USD = ${newRate} HTG`);
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur de mise à jour");
    } finally {
      setSavingRate(false);
    }
  };

  const saveDelivery = async () => {
    const f = Number(fee);
    const t = Number(threshold);
    if (!Number.isFinite(f) || f < 0) {
      toast.error("Les frais de livraison doivent être positifs ou nuls");
      return;
    }
    if (!Number.isFinite(t) || t < 0) {
      toast.error("Le seuil de gratuité doit être positif ou nul");
      return;
    }
    setSavingDelivery(true);
    try {
      // Two PATCHes — the backend supports them independently so we do them
      // in sequence, surfacing whichever errors first.
      let updated = await settingsApi.updateDeliveryFee(f);
      updated = await settingsApi.updateFreeDeliveryThreshold(t);
      setDeliveryFeeValue(Number(updated.delivery_fee_htg));
      setFreeDeliveryThresholdValue(Number(updated.free_delivery_threshold_htg));
      await refresh();
      toast.success("Livraison mise à jour.");
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur de mise à jour");
    } finally {
      setSavingDelivery(false);
    }
  };

  return (
    <div>
      <h1 className="font-display text-3xl">Paramètres système</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Réglages globaux de la plateforme. Réservé au super_admin.
      </p>

      <div className="gold-divider my-6" />

      <section className="border border-border bg-card p-6 sm:max-w-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center border border-gold/40 text-gold">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-xl">Taux de change USD → HTG</h2>
            <p className="text-xs text-muted-foreground">
              Appliqué à toutes les nouvelles commandes. Les commandes passées
              gardent le taux qui était en vigueur au moment du paiement.
            </p>
          </div>
        </div>

        <div className="gold-divider my-5" />

        <label className="block">
          <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Combien de gourdes pour 1 dollar US ?
          </span>
          <div className="mt-2 flex items-center gap-3">
            <span className="font-display text-xl text-muted-foreground">1 USD =</span>
            <input
              type="number"
              min={1}
              step="0.01"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="w-40 border border-border bg-background px-3 py-2 text-lg focus:border-gold focus:outline-none"
            />
            <span className="font-display text-xl text-gold">HTG</span>
          </div>
        </label>

        <div className="mt-5 grid gap-2 border border-border bg-background/40 p-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">$1 →</p>
            <p className="mt-0.5 text-gold">{Number(rate || 0).toLocaleString("fr-HT")} HTG</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">$10 →</p>
            <p className="mt-0.5 text-gold">{(Number(rate || 0) * 10).toLocaleString("fr-HT")} HTG</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">$100 →</p>
            <p className="mt-0.5 text-gold">{(Number(rate || 0) * 100).toLocaleString("fr-HT")} HTG</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="luxe" onClick={saveRate} disabled={savingRate}>
            {savingRate
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enregistrement…</>
              : <><Save className="mr-2 h-4 w-4" /> Enregistrer le taux</>}
          </Button>
        </div>
      </section>

      <section className="mt-6 border border-border bg-card p-6 sm:max-w-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center border border-gold/40 text-gold">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-xl">Livraison</h2>
            <p className="text-xs text-muted-foreground">
              Frais de livraison à domicile et seuil de gratuité, en gourdes.
              Modifiables à tout moment ; appliqué aux nouvelles commandes.
            </p>
          </div>
        </div>

        <div className="gold-divider my-5" />

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Frais de livraison
            </span>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={0}
                step="1"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                className="w-full border border-border bg-background px-3 py-2 text-lg focus:border-gold focus:outline-none"
              />
              <span className="font-display text-base text-gold">HTG</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Facturé au client quand il coche « Faire livrer ».
            </p>
          </label>

          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Livraison offerte à partir de
            </span>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={0}
                step="50"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="w-full border border-border bg-background px-3 py-2 text-lg focus:border-gold focus:outline-none"
              />
              <span className="font-display text-base text-gold">HTG</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Sous-total au-dessus duquel les frais passent à 0.
            </p>
          </label>
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="luxe" onClick={saveDelivery} disabled={savingDelivery}>
            {savingDelivery
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enregistrement…</>
              : <><Save className="mr-2 h-4 w-4" /> Enregistrer la livraison</>}
          </Button>
        </div>
      </section>
    </div>
  );
}
