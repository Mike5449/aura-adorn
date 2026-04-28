import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Package, Truck, ShieldCheck, Copy, Check } from "lucide-react";
import { orderApi } from "@/lib/api";
import type { ApiOrder } from "@/lib/api-types";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { toast } from "sonner";

const searchSchema = z.object({
  order: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/checkout/success")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Commande confirmée — Carat & Couleur" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SuccessPage,
});

function SuccessPage() {
  const { order: orderNumber } = Route.useSearch();
  const [order, setOrder] = useState<ApiOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!orderNumber) {
      setLoading(false);
      return;
    }
    orderApi
      .getByNumber(orderNumber)
      .then(setOrder)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orderNumber]);

  const copyOrderNumber = () => {
    if (!order) return;
    navigator.clipboard
      ?.writeText(order.order_number)
      .then(() => {
        setCopied(true);
        toast.success("Numéro de commande copié");
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => toast.error("Impossible de copier"));
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-32 text-center">
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-gold" />
        <p className="mt-4 text-sm text-muted-foreground">Chargement de la commande…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <div className="text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-emerald-500/40 bg-emerald-500/10">
          <CheckCircle2 className="h-12 w-12 text-emerald-500" />
        </div>
        <span className="mt-6 inline-block text-xs uppercase tracking-[0.4em] text-emerald-400">
          Paiement confirmé
        </span>
        <h1 className="mt-3 font-display text-5xl md:text-6xl">Merci !</h1>
        <p className="mt-4 text-base text-muted-foreground">
          {order ? `${order.customer_name}, votre` : "Votre"} commande a bien été enregistrée.
          Un e-mail de confirmation vous sera envoyé sous peu.
        </p>
      </div>

      <div className="gold-divider mx-auto my-12 max-w-xs" />

      {order ? (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="border border-border bg-card p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Numéro de commande</p>
              <div className="mt-2 flex items-center gap-2">
                <p className="font-display text-2xl text-gold">{order.order_number}</p>
                <button
                  onClick={copyOrderNumber}
                  className="text-muted-foreground hover:text-gold"
                  aria-label="Copier"
                  title="Copier le numéro"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Conservez ce numéro pour suivre votre commande.
              </p>
            </div>

            <div className="border border-border bg-card p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Montant payé</p>
              <p className="mt-2 font-display text-2xl text-gold">
                {Number(order.total_amount).toLocaleString("fr-HT")} {order.currency}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                via MonCash — paiement vérifié.
              </p>
            </div>
          </div>

          <div className="mt-6 border border-border bg-card p-6">
            <h2 className="text-xs uppercase tracking-[0.3em] text-gold">Articles</h2>
            <ul className="mt-4 divide-y divide-border">
              {order.items.map((it) => (
                <li key={it.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">{it.product_name}</p>
                    {it.size_label && (
                      <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                        Taille : {it.size_label}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p>x{it.quantity}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {Number(it.unit_price).toLocaleString("fr-HT")} {order.currency}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 border border-border bg-card p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xs uppercase tracking-[0.3em] text-gold">Livraison</h2>
              {order.delivery_requested ? (
                Number(order.delivery_fee) > 0 ? (
                  <span className="border border-gold/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-gold">
                    Livraison à domicile · {Number(order.delivery_fee).toLocaleString("fr-HT")} HTG
                  </span>
                ) : (
                  <span className="border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                    Livraison offerte 🎁
                  </span>
                )
              ) : (
                <span className="border border-border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Récupération sur place
                </span>
              )}
            </div>
            <div className="mt-4 grid gap-1 text-sm">
              <p className="font-medium">{order.customer_name}</p>
              <p className="text-muted-foreground">{order.customer_address}</p>
              <p className="text-muted-foreground">{order.customer_city}</p>
              <p className="text-muted-foreground">{order.customer_phone}</p>
              <p className="text-muted-foreground">{order.customer_email}</p>
            </div>

            {order.subtotal && Number(order.delivery_fee) > 0 && (
              <div className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Sous-total</span>
                  <span>{Number(order.subtotal).toLocaleString("fr-HT")} {order.currency}</span>
                </div>
                <div className="flex justify-between">
                  <span>Frais de livraison</span>
                  <span>{Number(order.delivery_fee).toLocaleString("fr-HT")} {order.currency}</span>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          Détails de la commande indisponibles. Si besoin, contactez-nous avec votre numéro de transaction.
        </p>
      )}

      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        {[
          { Icon: Package, title: "Préparation", desc: "Votre commande est en cours de préparation par nos équipes." },
          { Icon: Truck, title: "Expédition", desc: "Vous recevrez un e-mail dès qu'elle quittera notre atelier." },
          { Icon: ShieldCheck, title: "Garantie", desc: "Toutes nos pièces sont garanties à vie sur la fabrication." },
        ].map(({ Icon, title, desc }) => (
          <div key={title} className="border border-border bg-card p-5 text-center">
            <Icon className="mx-auto h-6 w-6 text-gold" />
            <p className="mt-3 text-sm font-medium">{title}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>

      <div className="mt-12 flex flex-wrap justify-center gap-3">
        <Button variant="luxe" size="xl" asChild>
          <Link to="/shop">Continuer mes achats</Link>
        </Button>
        <Button variant="outlineGold" size="xl" asChild>
          <Link to="/">Retour à l'accueil</Link>
        </Button>
      </div>
    </div>
  );
}
