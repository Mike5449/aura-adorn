import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Pencil, Plus, Save, Trash2, X, Package, Calendar, Truck } from "lucide-react";
import { stockApi } from "@/lib/api";
import type { ApiStock } from "@/lib/api-types";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/stocks")({
  component: AdminStocks,
});

interface DraftStock {
  id?: number;
  reference: string;
  order_date: string;
  arrival_date: string;
  total_amount: string;
  shipping_amount: string;
  quantity: string;
  notes: string;
}

const today = () => new Date().toISOString().slice(0, 10);

const blank: DraftStock = {
  reference: "",
  order_date: today(),
  arrival_date: "",
  total_amount: "0",
  shipping_amount: "0",
  quantity: "0",
  notes: "",
};

function fromApi(s: ApiStock): DraftStock {
  return {
    id: s.id,
    reference: s.reference ?? "",
    order_date: s.order_date,
    arrival_date: s.arrival_date ?? "",
    total_amount: s.total_amount,
    shipping_amount: s.shipping_amount,
    quantity: String(s.quantity),
    notes: s.notes ?? "",
  };
}

function AdminStocks() {
  const { isSuperAdmin } = useAuth();
  const [stocks, setStocks] = useState<ApiStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<DraftStock | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      setStocks(await stockApi.list());
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const totals = useMemo(() => {
    return stocks.reduce(
      (acc, s) => ({
        merchandise: acc.merchandise + Number(s.total_amount),
        shipping: acc.shipping + Number(s.shipping_amount),
        quantity: acc.quantity + s.quantity,
      }),
      { merchandise: 0, shipping: 0, quantity: 0 },
    );
  }, [stocks]);

  const submit = async () => {
    if (!editing) return;
    if (!editing.order_date) { toast.error("Date de la commande requise"); return; }
    setSaving(true);
    try {
      const payload = {
        reference: editing.reference.trim() || null,
        order_date: editing.order_date,
        arrival_date: editing.arrival_date || null,
        total_amount: editing.total_amount || "0",
        shipping_amount: editing.shipping_amount || "0",
        quantity: Number(editing.quantity) || 0,
        notes: editing.notes.trim() || null,
      };
      if (editing.id) {
        await stockApi.update(editing.id, payload);
        toast.success("Stock mis à jour");
      } else {
        await stockApi.create(payload);
        toast.success("Stock enregistré");
      }
      setEditing(null);
      reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s: ApiStock) => {
    if (!confirm(`Supprimer ce stock du ${s.order_date} (${s.quantity} unités) ?`)) return;
    try {
      await stockApi.remove(s.id);
      toast.success("Stock supprimé");
      reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Suppression impossible");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Stocks / Arrivages</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isSuperAdmin
              ? "Tous les arrivages enregistrés par les admins."
              : "Vos arrivages fournisseur — coût des produits, livraison, quantités."}
          </p>
        </div>
        <Button variant="luxe" onClick={() => setEditing({ ...blank })}>
          <Plus className="mr-2 h-4 w-4" /> Nouveau stock
        </Button>
      </div>

      <div className="gold-divider my-6" />

      {/* Totals row */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <SummaryCard icon={<Package className="h-5 w-5 text-gold" />} label="Marchandise totale" value={totals.merchandise} suffix="HTG" />
        <SummaryCard icon={<Truck className="h-5 w-5 text-gold" />} label="Frais de livraison" value={totals.shipping} suffix="HTG" />
        <SummaryCard icon={<Calendar className="h-5 w-5 text-gold" />} label="Quantité totale reçue" value={totals.quantity} suffix="unités" />
      </div>

      {editing && (
        <div className="mb-6 border border-gold bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl">
              {editing.id ? "Modifier le stock" : "Nouveau stock"}
            </h2>
            <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground" aria-label="Annuler">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Référence (optionnel)">
              <input
                value={editing.reference}
                onChange={(e) => setEditing({ ...editing, reference: e.target.value })}
                placeholder="PO-2026-001 ou nom du fournisseur"
                className={input}
              />
            </Field>

            <Field label="Quantité de produits *">
              <input
                type="number"
                min={0}
                value={editing.quantity}
                onChange={(e) => setEditing({ ...editing, quantity: e.target.value })}
                className={input}
              />
            </Field>

            <Field label="Date de la commande *">
              <input
                type="date"
                value={editing.order_date}
                onChange={(e) => setEditing({ ...editing, order_date: e.target.value })}
                className={input}
              />
            </Field>

            <Field label="Date d'arrivée">
              <input
                type="date"
                value={editing.arrival_date}
                onChange={(e) => setEditing({ ...editing, arrival_date: e.target.value })}
                className={input}
              />
            </Field>

            <Field label="Montant total du stock (HTG) *">
              <input
                type="number"
                min={0}
                step="0.01"
                value={editing.total_amount}
                onChange={(e) => setEditing({ ...editing, total_amount: e.target.value })}
                className={input}
              />
            </Field>

            <Field label="Frais de livraison (HTG)">
              <input
                type="number"
                min={0}
                step="0.01"
                value={editing.shipping_amount}
                onChange={(e) => setEditing({ ...editing, shipping_amount: e.target.value })}
                className={input}
              />
            </Field>

            <Field label="Notes (optionnel)">
              <textarea
                rows={2}
                value={editing.notes}
                onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                placeholder="Fournisseur, contenu de l'arrivage, remarques…"
                className={`${input} resize-none sm:col-span-2`}
              />
            </Field>
          </div>

          {/* Live cost-per-unit + total + shipping-per-unit */}
          {(() => {
            const total = Number(editing.total_amount) || 0;
            const ship = Number(editing.shipping_amount) || 0;
            const qty = Number(editing.quantity) || 0;
            const grand = total + ship;
            const perUnit = qty > 0 ? grand / qty : 0;
            const shipPerUnit = qty > 0 ? ship / qty : 0;
            if (grand <= 0 && qty <= 0) return null;
            return (
              <div className="mt-5 grid gap-2 border border-border bg-background/40 p-4 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Coût total</p>
                  <p className="mt-0.5 text-gold">{grand.toLocaleString("fr-HT")} HTG</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Quantité</p>
                  <p className="mt-0.5">{qty} unités</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Shipping / unité</p>
                  <p className="mt-0.5 text-muted-foreground">
                    {qty > 0 && ship > 0
                      ? `${shipPerUnit.toLocaleString("fr-HT", { maximumFractionDigits: 2 })} HTG`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Coût / unité</p>
                  <p className="mt-0.5 text-gold">
                    {qty > 0 ? `${perUnit.toLocaleString("fr-HT", { maximumFractionDigits: 2 })} HTG` : "—"}
                  </p>
                </div>
              </div>
            );
          })()}

          <div className="mt-6 flex justify-end gap-2">
            <Button type="button" variant="outlineGold" onClick={() => setEditing(null)}>
              Annuler
            </Button>
            <Button type="button" variant="luxe" disabled={saving} onClick={submit}>
              {saving
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enregistrement…</>
                : <><Save className="mr-2 h-4 w-4" /> Enregistrer</>}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
        </div>
      ) : stocks.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">Aucun stock pour l'instant.</p>
      ) : (
        <div className="overflow-x-auto border border-border">
          <table className="w-full text-sm">
            <thead className="bg-card text-left text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <tr>
                <th className="p-3">Réf.</th>
                {isSuperAdmin && <th className="p-3">Admin</th>}
                <th className="p-3">Date commande</th>
                <th className="p-3">Date arrivée</th>
                <th className="p-3">Marchandise</th>
                <th className="p-3">Livraison</th>
                <th className="p-3">Quantité</th>
                <th className="p-3">Shipping/produit</th>
                <th className="p-3">Coût/unité</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {stocks.map((s) => {
                const total = Number(s.total_amount) + Number(s.shipping_amount);
                const perUnit = s.quantity > 0 ? total / s.quantity : 0;
                const shipPerUnit = s.quantity > 0 ? Number(s.shipping_amount) / s.quantity : 0;
                return (
                  <tr key={s.id} className="hover:bg-card/40">
                    <td className="p-3 text-muted-foreground">{s.reference ?? "—"}</td>
                    {isSuperAdmin && <td className="p-3 text-xs">{s.admin_username}</td>}
                    <td className="p-3">{s.order_date}</td>
                    <td className="p-3">
                      {s.arrival_date ?? <span className="text-muted-foreground/60 italic">en attente</span>}
                    </td>
                    <td className="p-3">{Number(s.total_amount).toLocaleString("fr-HT")} {s.currency}</td>
                    <td className="p-3">{Number(s.shipping_amount).toLocaleString("fr-HT")} {s.currency}</td>
                    <td className="p-3">{s.quantity}</td>
                    <td className="p-3 text-muted-foreground">
                      {s.quantity > 0 && Number(s.shipping_amount) > 0
                        ? `${shipPerUnit.toLocaleString("fr-HT", { maximumFractionDigits: 2 })} ${s.currency}`
                        : <span className="text-muted-foreground/50">—</span>}
                    </td>
                    <td className="p-3 text-gold">
                      {s.quantity > 0
                        ? `${perUnit.toLocaleString("fr-HT", { maximumFractionDigits: 2 })} ${s.currency}`
                        : "—"}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditing(fromApi(s))}
                          className="inline-flex h-8 w-8 items-center justify-center border border-border text-muted-foreground hover:border-gold hover:text-gold"
                          title="Modifier"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => remove(s)}
                          className="inline-flex h-8 w-8 items-center justify-center border border-border text-muted-foreground hover:border-destructive hover:text-destructive"
                          title="Supprimer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const input =
  "w-full border border-border bg-background px-3 py-2 text-sm focus:border-gold focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function SummaryCard({ icon, label, value, suffix }: { icon: React.ReactNode; label: string; value: number; suffix: string }) {
  return (
    <div className="border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      </div>
      <p className="mt-2 font-display text-2xl text-gold">
        {value.toLocaleString("fr-HT")} <span className="text-xs text-muted-foreground">{suffix}</span>
      </p>
    </div>
  );
}
