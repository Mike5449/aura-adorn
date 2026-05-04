import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Loader2, ImageOff, Crown, Shield } from "lucide-react";
import { orderApi, resolveImageUrl, userApi } from "@/lib/api";
import type { ApiOrder, ApiUser, OrderStatus } from "@/lib/api-types";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

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
  const { isSuperAdmin } = useAuth();
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [admins, setAdmins] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const [ownerFilter, setOwnerFilter] = useState<"all" | number>("all");
  const [selected, setSelected] = useState<ApiOrder | null>(null);

  // Lookup map admin id -> ApiUser, used for the owner column / grouping
  const adminById = useMemo(() => {
    const m = new Map<number, ApiUser>();
    for (const a of admins) m.set(a.id, a);
    return m;
  }, [admins]);

  // Total platform commission across the currently filtered, paid orders.
  const totalCommission = useMemo(() => {
    return orders
      .filter((o) => o.payment_status === "success")
      .reduce((sum, o) => sum + Number(o.platform_commission_htg ?? 0), 0);
  }, [orders]);

  // Group orders by primary owner (first owner_user_id). Stable order:
  // groups appear in the order their first order shows up in the
  // already-sorted-by-date orders array.
  const groups = useMemo(() => {
    const out: { ownerId: number | null; orders: ApiOrder[] }[] = [];
    const indexById = new Map<number | null, number>();
    for (const o of orders) {
      const ownerId = o.owner_user_ids[0] ?? null;
      const idx = indexById.get(ownerId);
      if (idx == null) {
        indexById.set(ownerId, out.length);
        out.push({ ownerId, orders: [o] });
      } else {
        out[idx].orders.push(o);
      }
    }
    return out;
  }, [orders]);

  // Only group visually when the super_admin sees multiple owners and
  // hasn't filtered to a single one. Otherwise show a flat table.
  const showGrouping = isSuperAdmin && ownerFilter === "all" && groups.length > 1;

  const reload = async () => {
    setLoading(true);
    try {
      const list = await orderApi.list({
        status: filter === "all" ? undefined : filter,
        owner_id: ownerFilter === "all" ? undefined : ownerFilter,
      });
      setOrders(list);
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  // Load the admin list once for the dropdown / username resolution
  // (super_admin only — scoped admins don't have access to /users/admins).
  useEffect(() => {
    if (!isSuperAdmin) return;
    userApi
      .listAdmins()
      .then(setAdmins)
      .catch(() => {
        /* non-blocking — the page still works without the dropdown */
      });
  }, [isSuperAdmin]);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, ownerFilter]);

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

      {isSuperAdmin && totalCommission > 0 && (
        <div className="mt-4 inline-flex items-center gap-3 border border-gold/40 bg-gold/5 px-4 py-2 text-sm">
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Commission plateforme (commandes affichées)
          </span>
          <strong className="font-display text-lg text-gold">
            {totalCommission.toLocaleString("fr-HT", { maximumFractionDigits: 0 })} HTG
          </strong>
        </div>
      )}

      <div className="gold-divider my-6" />

      <div className="mb-4 flex flex-wrap gap-2">
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

      {isSuperAdmin && admins.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Filtrer par admin
          </label>
          <select
            value={String(ownerFilter)}
            onChange={(e) =>
              setOwnerFilter(e.target.value === "all" ? "all" : Number(e.target.value))
            }
            className="border border-border bg-background px-3 py-2 text-sm focus:border-gold focus:outline-none"
          >
            <option value="all">Tous les admins</option>
            {admins.map((a) => (
              <option key={a.id} value={a.id}>
                {a.role === "super_admin" ? "👑 " : ""}
                {a.username}
              </option>
            ))}
          </select>
          {ownerFilter !== "all" && (
            <button
              onClick={() => setOwnerFilter("all")}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline hover:text-foreground"
            >
              effacer le filtre
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
        </div>
      ) : orders.length === 0 ? (
        <p className="py-24 text-center text-muted-foreground">Aucune commande pour ce filtre.</p>
      ) : showGrouping ? (
        <div className="space-y-8">
          {groups.map((g) => {
            const owner = g.ownerId ? adminById.get(g.ownerId) : null;
            const groupCommission = g.orders
              .filter((o) => o.payment_status === "success")
              .reduce((s, o) => s + Number(o.platform_commission_htg ?? 0), 0);
            const groupTotal = g.orders.reduce(
              (s, o) => s + Number(o.total_amount),
              0,
            );
            return (
              <section key={g.ownerId ?? "unknown"}>
                <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-2">
                  <div className="flex items-center gap-3">
                    {owner?.role === "super_admin" ? (
                      <Crown className="h-4 w-4 text-gold" />
                    ) : (
                      <Shield className="h-4 w-4 text-muted-foreground" />
                    )}
                    <h2 className="font-display text-lg">
                      {owner ? owner.username : "Vendeur inconnu"}
                    </h2>
                    <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      {g.orders.length} commande{g.orders.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>
                      Total :{" "}
                      <strong className="text-foreground">
                        {groupTotal.toLocaleString("fr-HT", { maximumFractionDigits: 0 })} HTG
                      </strong>
                    </span>
                    {groupCommission > 0 && (
                      <span>
                        Commission :{" "}
                        <strong className="text-gold">
                          {groupCommission.toLocaleString("fr-HT", { maximumFractionDigits: 0 })} HTG
                        </strong>
                      </span>
                    )}
                  </div>
                </header>
                <div className="overflow-hidden border border-border">
                  <table className="w-full text-sm">
                    <OrderTableHead isSuperAdmin={isSuperAdmin} />
                    <tbody className="divide-y divide-border">
                      {g.orders.map((o) => (
                        <OrderRow
                          key={o.id}
                          o={o}
                          isSuperAdmin={isSuperAdmin}
                          onSelect={setSelected}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden border border-border">
          <table className="w-full text-sm">
            <OrderTableHead isSuperAdmin={isSuperAdmin} />
            <tbody className="divide-y divide-border">
              {orders.map((o) => (
                <OrderRow
                  key={o.id}
                  o={o}
                  isSuperAdmin={isSuperAdmin}
                  onSelect={setSelected}
                />
              ))}
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

// ---------------------------------------------------------------------------
// Reusable bits — extracted so the same row layout can render either flat
// or inside per-admin groups without duplicating markup.
// ---------------------------------------------------------------------------

function OrderTableHead({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  return (
    <thead className="bg-card text-left text-xs uppercase tracking-[0.2em] text-muted-foreground">
      <tr>
        <th className="p-3">N°</th>
        <th className="p-3">Client</th>
        <th className="p-3">Articles</th>
        <th className="p-3">Total</th>
        <th className="p-3">Paiement</th>
        {isSuperAdmin && <th className="p-3">Commission</th>}
        <th className="p-3">Statut</th>
        <th className="p-3">Date</th>
        <th className="p-3"></th>
      </tr>
    </thead>
  );
}

function OrderRow({
  o,
  isSuperAdmin,
  onSelect,
}: {
  o: ApiOrder;
  isSuperAdmin: boolean;
  onSelect: (o: ApiOrder) => void;
}) {
  const totalQty = o.items.reduce((s, it) => s + it.quantity, 0);
  const firstName = o.items[0]?.product_name ?? "—";
  const otherCount = o.items.length - 1;

  return (
    <tr
      onClick={() => onSelect(o)}
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
        <span
          className={`inline-block rounded border px-2 py-0.5 text-[11px] uppercase tracking-widest ${
            o.payment_status === "success"
              ? "border-emerald-500/40 text-emerald-400"
              : o.payment_status === "failed"
                ? "border-destructive/40 text-destructive"
                : "border-border text-muted-foreground"
          }`}
        >
          {o.payment_method.toUpperCase()} · {o.payment_status}
        </span>
      </td>
      {isSuperAdmin && (
        <td className="p-3 text-sm">
          {Number(o.platform_commission_htg ?? 0) > 0 ? (
            <span className="font-medium text-gold">
              {Number(o.platform_commission_htg).toLocaleString("fr-HT", {
                maximumFractionDigits: 0,
              })}{" "}
              HTG
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
      )}
      <td className="p-3">
        <span
          className={`inline-block rounded border px-2 py-0.5 text-[11px] uppercase tracking-widest ${STATUS_COLOR[o.status]}`}
        >
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
}
