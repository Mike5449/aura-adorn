import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronRight, Loader2, ImageOff } from "lucide-react";
import { orderApi, resolveImageUrl } from "@/lib/api";
import type { ApiOrder, OrderStatus } from "@/lib/api-types";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/orders")({
  component: AdminOrders,
});

const STATUS_OPTIONS: OrderStatus[] = [
  "pending",
  "paid",
  "shipped",
  "delivered",
  "cancelled",
];

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "En attente",
  paid: "Payée",
  shipped: "Expédiée",
  delivered: "Livrée",
  cancelled: "Annulée",
};

const STATUS_COLOR: Record<OrderStatus, string> = {
  pending: "text-muted-foreground border-border",
  paid: "text-emerald-400 border-emerald-500/40",
  shipped: "text-sky-400 border-sky-500/40",
  delivered: "text-emerald-400 border-emerald-500/40",
  cancelled: "text-destructive border-destructive/40",
};

function AdminOrders() {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const [selected, setSelected] = useState<ApiOrder | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const list = await orderApi.list(filter === "all" ? undefined : filter);
      setOrders(list);
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const setStatus = async (order: ApiOrder, status: OrderStatus) => {
    try {
      const updated = await orderApi.setStatus(order.id, status);
      setOrders((list) => list.map((o) => (o.id === order.id ? updated : o)));
      if (selected?.id === order.id) setSelected(updated);
      toast.success("Statut mis à jour");
    } catch (e: any) {
      toast.error(e?.message ?? "Mise à jour impossible");
    }
  };

  return (
    <div>
      <h1 className="font-display text-3xl">Commandes</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Suivi des paiements MonCash et de l'expédition. <strong>Cliquez sur une ligne</strong> pour voir le détail (articles, client, livraison) et changer le statut.
      </p>

      <div className="gold-divider my-6" />

      <div className="mb-6 flex flex-wrap gap-2">
        {(["all", ...STATUS_OPTIONS] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`border px-4 py-2 text-xs uppercase tracking-[0.2em] transition-colors ${
              filter === s
                ? "border-gold bg-gold text-primary-foreground"
                : "border-border text-muted-foreground hover:border-gold hover:text-gold"
            }`}
          >
            {s === "all" ? "Toutes" : STATUS_LABEL[s as OrderStatus]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
        </div>
      ) : orders.length === 0 ? (
        <p className="py-24 text-center text-muted-foreground">Aucune commande pour ce filtre.</p>
      ) : (
        <div className="overflow-hidden border border-border">
          <table className="w-full text-sm">
            <thead className="bg-card text-left text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <tr>
                <th className="p-3">N°</th>
                <th className="p-3">Client</th>
                <th className="p-3">Articles</th>
                <th className="p-3">Total</th>
                <th className="p-3">Paiement</th>
                <th className="p-3">Statut</th>
                <th className="p-3">Date</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map((o) => {
                const totalQty = o.items.reduce((s, it) => s + it.quantity, 0);
                const firstName = o.items[0]?.product_name ?? "—";
                const otherCount = o.items.length - 1;
                return (
                  <tr
                    key={o.id}
                    onClick={() => setSelected(o)}
                    className="cursor-pointer hover:bg-card/40"
                  >
                    <td className="p-3 font-mono text-xs">{o.order_number}</td>
                    <td className="p-3">
                      <p className="font-medium">{o.customer_name}</p>
                      <p className="text-xs text-muted-foreground">{o.customer_email}</p>
                    </td>
                    <td className="p-3">
                      <div
                        className="flex items-start gap-3"
                        title={o.items.map((it) => `${it.quantity}× ${it.product_name}`).join(", ")}
                      >
                        {o.items[0]?.image_url ? (
                          <img
                            src={resolveImageUrl(o.items[0].image_url)}
                            alt={firstName}
                            className="h-12 w-12 shrink-0 border border-border object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-border bg-background/40 text-muted-foreground">
                            <ImageOff className="h-4 w-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="line-clamp-2 font-medium leading-tight">{firstName}</p>
                          {otherCount > 0 && (
                            <p className="text-[11px] text-muted-foreground">
                              + {otherCount} autre{otherCount > 1 ? "s" : ""}
                            </p>
                          )}
                          <p className="mt-1 text-[10px] uppercase tracking-widest text-gold/70">
                            {totalQty} unité{totalQty > 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      {Number(o.total_amount).toLocaleString("fr-HT")} {o.currency}
                    </td>
                    <td className="p-3">
                      <span className={`inline-block rounded border px-2 py-0.5 text-[11px] uppercase tracking-widest ${
                        o.payment_status === "success"
                          ? "border-emerald-500/40 text-emerald-400"
                          : o.payment_status === "failed"
                            ? "border-destructive/40 text-destructive"
                            : "border-border text-muted-foreground"
                      }`}>
                        {o.payment_method.toUpperCase()} · {o.payment_status}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`inline-block rounded border px-2 py-0.5 text-[11px] uppercase tracking-widest ${STATUS_COLOR[o.status]}`}>
                        {STATUS_LABEL[o.status]}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {new Date(o.created_at).toLocaleString("fr-HT")}
                    </td>
                    <td className="p-3 text-right text-muted-foreground">
                      <ChevronRight className="inline h-4 w-4" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div
          onClick={() => setSelected(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-3xl overflow-auto border border-border bg-card p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Commande</p>
                <h2 className="mt-1 font-display text-3xl text-gold">{selected.order_number}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(selected.created_at).toLocaleString("fr-HT")}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground" aria-label="Fermer">
                ✕
              </button>
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="text-xs uppercase tracking-[0.3em] text-gold">Client</h3>
                <div className="mt-3 space-y-1 text-sm">
                  <p>{selected.customer_name}</p>
                  <p className="text-muted-foreground">{selected.customer_email}</p>
                  <p className="text-muted-foreground">{selected.customer_phone}</p>
                  <p className="text-muted-foreground">{selected.customer_address}</p>
                  <p className="text-muted-foreground">{selected.customer_city}</p>
                  {selected.notes && (
                    <p className="mt-3 italic text-muted-foreground">« {selected.notes} »</p>
                  )}
                </div>

                <h3 className="mt-6 text-xs uppercase tracking-[0.3em] text-gold">Livraison</h3>
                <div className="mt-3 space-y-1 text-sm">
                  {selected.delivery_requested ? (
                    Number(selected.delivery_fee) > 0 ? (
                      <p className="text-foreground">
                        Livraison à domicile · <strong className="text-gold">{Number(selected.delivery_fee).toLocaleString("fr-HT")} {selected.currency}</strong>
                      </p>
                    ) : (
                      <p className="text-emerald-400">
                        Livraison offerte (commande {">="} {Number(2500).toLocaleString("fr-HT")} HTG)
                      </p>
                    )
                  ) : (
                    <p className="text-muted-foreground">Récupération sur place — pas de livraison</p>
                  )}
                  {selected.subtotal && (
                    <p className="text-xs text-muted-foreground">
                      Sous-total : {Number(selected.subtotal).toLocaleString("fr-HT")} {selected.currency}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-xs uppercase tracking-[0.3em] text-gold">Paiement</h3>
                <div className="mt-3 space-y-1 text-sm">
                  <p>Méthode : <strong>{selected.payment_method.toUpperCase()}</strong></p>
                  <p>État : <strong>{selected.payment_status}</strong></p>
                  {selected.payment_reference && (
                    <p className="break-all text-xs text-muted-foreground">
                      Réf. : {selected.payment_reference}
                    </p>
                  )}
                </div>

                <h3 className="mt-6 text-xs uppercase tracking-[0.3em] text-gold">Statut</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatus(selected, s)}
                      className={`border px-3 py-1.5 text-xs uppercase tracking-[0.2em] transition-colors ${
                        selected.status === s
                          ? "border-gold bg-gold text-primary-foreground"
                          : "border-border text-muted-foreground hover:border-gold hover:text-gold"
                      }`}
                    >
                      {STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8">
              <h3 className="text-xs uppercase tracking-[0.3em] text-gold">Articles</h3>
              <ul className="mt-3 divide-y divide-border border-y border-border">
                {selected.items.map((it) => (
                  <li key={it.id} className="flex items-center gap-4 py-3 text-sm">
                    {it.image_url ? (
                      <img
                        src={resolveImageUrl(it.image_url)}
                        alt={it.product_name}
                        className="h-16 w-16 shrink-0 border border-border object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center border border-border bg-background/40 text-muted-foreground">
                        <ImageOff className="h-5 w-5" />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{it.product_name}</p>
                      {it.size_label && (
                        <p className="text-xs text-muted-foreground">Taille : {it.size_label}</p>
                      )}
                      {it.color_label && (
                        <p className="text-xs text-muted-foreground">Couleur : {it.color_label}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p>x{it.quantity}</p>
                      <p className="text-xs text-muted-foreground">
                        {Number(it.unit_price).toLocaleString("fr-HT")} {selected.currency}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex justify-end gap-6 text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="font-display text-2xl text-gold">
                  {Number(selected.total_amount).toLocaleString("fr-HT")} {selected.currency}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
