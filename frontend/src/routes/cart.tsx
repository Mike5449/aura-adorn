import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCart } from "@/context/CartContext";
import { formatPrice } from "@/data/products";
import {
  DELIVERY_CITY,
  DELIVERY_FEE_HTG,
  FREE_DELIVERY_THRESHOLD_HTG,
  computeDeliveryFee,
  isDeliveryEligibleCity,
} from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Loader2, MapPin, Minus, Plus, Smartphone, Truck, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { orderApi, resolveImageUrl } from "@/lib/api";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Mon Panier — Carat & Couleur" },
      { name: "description", content: "Vérifiez votre sélection et finalisez votre commande." },
    ],
  }),
  component: CartPage,
});

interface CheckoutForm {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  customer_city: string;
  notes: string;
}

const emptyForm: CheckoutForm = {
  customer_name: "",
  customer_email: "",
  customer_phone: "",
  customer_address: "",
  customer_city: "",
  notes: "",
};

function CartPage() {
  const { items, setQty, remove, total, clear, keyOf } = useCart();
  const [form, setForm] = useState<CheckoutForm>(emptyForm);
  const [deliveryRequested, setDeliveryRequested] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const update = (k: keyof CheckoutForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const cityEligible = useMemo(
    () => isDeliveryEligibleCity(form.customer_city),
    [form.customer_city],
  );
  const deliveryFee = computeDeliveryFee(total, deliveryRequested);
  const deliveryIsFree = deliveryRequested && total >= FREE_DELIVERY_THRESHOLD_HTG;
  const finalTotal = total + deliveryFee;
  const amountToFreeDelivery = Math.max(0, FREE_DELIVERY_THRESHOLD_HTG - total);

  const checkout = async () => {
    if (items.length === 0) return;
    if (!form.customer_name || !form.customer_email || !form.customer_phone || !form.customer_address || !form.customer_city) {
      toast.error("Veuillez remplir tous les champs obligatoires.");
      return;
    }
    if (deliveryRequested && !cityEligible) {
      toast.error(`La livraison est disponible uniquement à ${DELIVERY_CITY}.`);
      return;
    }

    setSubmitting(true);
    try {
      const order = await orderApi.create({
        customer_name: form.customer_name,
        customer_email: form.customer_email,
        customer_phone: form.customer_phone,
        customer_address: form.customer_address,
        customer_city: form.customer_city,
        delivery_requested: deliveryRequested,
        notes: form.notes || undefined,
        items: items.map((i) => ({
          product_id: i.product.dbId,
          product_size_id: i.selectedSizeId ?? null,
          quantity: i.qty,
        })),
      });

      // Belt-and-suspenders: keep a local pointer to the pending order in
      // case MonCash's RetrieveTransactionPayment doesn't echo back our
      // orderId. /checkout/return will try the transactionId-only resolve
      // first and fall back to this if needed.
      try {
        localStorage.setItem(
          "maison_pending_order",
          JSON.stringify({ id: order.id, number: order.order_number, ts: Date.now() }),
        );
      } catch { /* storage disabled / private mode */ }

      const payment = await orderApi.initiateMonCash(order.id);
      clear();
      // Redirect the customer to the MonCash payment gateway
      window.location.href = payment.redirect_url;
    } catch (e: any) {
      toast.error(e?.message ?? "Une erreur est survenue lors du paiement.");
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-32 text-center">
        <h1 className="font-display text-5xl">Mon Panier</h1>
        <p className="mt-6 text-muted-foreground">Votre panier est vide. Découvrez nos dernières pièces.</p>
        <Button variant="luxe" size="xl" className="mt-10" asChild>
          <Link to="/shop">Voir la Collection</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <h1 className="text-center font-display text-5xl">Mon Panier</h1>
      <div className="gold-divider mx-auto mt-6 max-w-xs" />

      <div className="mt-14 grid gap-12 lg:grid-cols-[1fr_400px]">
        <div>
          <ul className="divide-y divide-border border-y border-border">
            {items.map((item) => {
              const k = keyOf(item);
              const { product, qty, selectedSizeLabel } = item;
              return (
                <li key={k} className="flex gap-6 py-6">
                  <Link to="/product/$id" params={{ id: product.id }}>
                    <img src={resolveImageUrl(product.image)} alt={product.name} className="h-32 w-32 object-cover" />
                  </Link>
                  <div className="flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <Link to="/product/$id" params={{ id: product.id }} className="font-medium hover:text-gold">
                        {product.name}
                      </Link>
                      <button onClick={() => remove(k)} className="text-muted-foreground hover:text-gold" aria-label="Retirer">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <span className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      {product.categoryName ?? product.category}
                    </span>
                    {selectedSizeLabel && (
                      <span className="mt-1 text-xs text-muted-foreground">
                        Taille : <strong className="text-foreground">{selectedSizeLabel}</strong>
                      </span>
                    )}
                    <div className="mt-auto flex items-center justify-between">
                      <div className="flex items-center border border-border">
                        <button onClick={() => setQty(k, qty - 1)} className="flex h-9 w-9 items-center justify-center hover:text-gold" aria-label="Diminuer"><Minus className="h-3 w-3" /></button>
                        <span className="w-8 text-center text-sm">{qty}</span>
                        <button onClick={() => setQty(k, qty + 1)} className="flex h-9 w-9 items-center justify-center hover:text-gold" aria-label="Augmenter"><Plus className="h-3 w-3" /></button>
                      </div>
                      <span className="text-gold">{formatPrice(product.price * qty)}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <button onClick={clear} className="mt-6 text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-gold">
            Vider le panier
          </button>
        </div>

        <aside className="h-fit border border-border bg-card p-8">
          <h2 className="font-display text-2xl">Récapitulatif</h2>
          <div className="gold-divider my-6" />

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sous-total</span>
              <span>{formatPrice(total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Livraison</span>
              {!deliveryRequested ? (
                <span className="text-muted-foreground">Non sélectionnée</span>
              ) : deliveryIsFree ? (
                <span className="text-emerald-400">Offerte 🎁</span>
              ) : (
                <span>{formatPrice(deliveryFee)}</span>
              )}
            </div>
          </div>

          {/* DELIVERY SECTION */}
          <div className="mt-6 border border-gold/20 bg-background/40 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={deliveryRequested}
                onChange={(e) => setDeliveryRequested(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-gold"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-gold" />
                  <span className="text-sm font-medium">Faire livrer ma commande</span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  <MapPin className="mr-1 inline h-3 w-3" />
                  Livraison disponible uniquement à <strong>{DELIVERY_CITY}</strong>.
                  Frais : <strong>{DELIVERY_FEE_HTG} HTG</strong> · Offerte à partir de <strong>{FREE_DELIVERY_THRESHOLD_HTG.toLocaleString("fr-HT")} HTG</strong>.
                </p>
              </div>
            </label>

            {deliveryRequested && (
              <div className="mt-3 space-y-2">
                {deliveryIsFree ? (
                  <p className="flex items-center gap-2 text-xs text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Bravo — votre commande dépasse {FREE_DELIVERY_THRESHOLD_HTG.toLocaleString("fr-HT")} HTG, la livraison est <strong>offerte</strong>.
                  </p>
                ) : amountToFreeDelivery > 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    Plus que <strong className="text-gold">{formatPrice(amountToFreeDelivery)}</strong> pour bénéficier de la livraison gratuite.
                  </p>
                ) : null}

                {form.customer_city && !cityEligible && (
                  <p className="flex items-start gap-2 text-xs text-amber-400">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Votre ville (<em>{form.customer_city}</em>) n'est pas desservie. Modifiez le champ « Ville » ci-dessous pour y mettre <strong>{DELIVERY_CITY}</strong>.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="my-6 border-t border-border pt-6">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.2em]">Total</span>
              <span className="text-2xl text-gold">{formatPrice(finalTotal)}</span>
            </div>
            {deliveryRequested && !deliveryIsFree && deliveryFee > 0 && (
              <p className="mt-1 text-right text-[11px] text-muted-foreground">
                inclus {formatPrice(deliveryFee)} de livraison
              </p>
            )}
          </div>

          <h3 className="mt-2 mb-4 text-xs uppercase tracking-[0.3em] text-gold">Coordonnées de livraison</h3>
          <div className="space-y-3">
            <Field label="Nom complet *">
              <input value={form.customer_name} onChange={(e) => update("customer_name", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Email *">
              <input type="email" value={form.customer_email} onChange={(e) => update("customer_email", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Téléphone (MonCash) *">
              <input type="tel" value={form.customer_phone} onChange={(e) => update("customer_phone", e.target.value)} placeholder="ex. 509 1234-5678" className={inputCls} />
            </Field>
            <Field label="Adresse *">
              <input value={form.customer_address} onChange={(e) => update("customer_address", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Ville *">
              <input value={form.customer_city} onChange={(e) => update("customer_city", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Notes (facultatif)">
              <textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={2} className={`${inputCls} resize-none`} />
            </Field>
          </div>

          <Button
            variant="luxe"
            size="xl"
            className="mt-6 w-full"
            disabled={submitting}
            onClick={checkout}
          >
            {submitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Redirection…</>
            ) : (
              <><Smartphone className="mr-2 h-4 w-4" /> Payer avec MonCash</>
            )}
          </Button>
          <p className="mt-3 text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Vous serez redirigé vers MonCash pour finaliser le paiement.
          </p>
        </aside>
      </div>
    </div>
  );
}

const inputCls =
  "w-full border border-border bg-background px-3 py-2 text-sm focus:border-gold focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
