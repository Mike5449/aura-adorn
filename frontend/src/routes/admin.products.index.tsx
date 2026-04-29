import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Loader2, Search, Hourglass, CheckCircle2 } from "lucide-react";
import { categoryApi, productApi, resolveImageUrl } from "@/lib/api";
import type { ApiCategory, ApiProduct } from "@/lib/api-types";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/products/")({
  component: AdminProductsList,
});

function AdminProductsList() {
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "available" | "coming_soon">("all");

  const reload = async () => {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([
        productApi.list({ active_only: false }),
        categoryApi.list(),
      ]);
      setProducts(p);
      setCategories(c);
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const remove = async (p: ApiProduct) => {
    if (!confirm(`Supprimer définitivement « ${p.name} » ?`)) return;
    try {
      await productApi.remove(p.id);
      toast.success("Produit supprimé");
      reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Suppression impossible");
    }
  };

  const filtered = products.filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (query && !p.name.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Produits</h1>
          <p className="mt-1 text-sm text-muted-foreground">{products.length} produit(s) au total.</p>
        </div>
        <Button variant="luxe" asChild>
          <Link to="/admin/products/$id" params={{ id: "new" }}>
            <Plus className="mr-2 h-4 w-4" /> Nouveau
          </Link>
        </Button>
      </div>

      <div className="gold-divider my-6" />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher…"
            className="w-72 border border-border bg-background py-2 pl-10 pr-3 text-sm focus:border-gold focus:outline-none"
          />
        </div>
        <div className="flex gap-2">
          {[
            { v: "all", label: "Tous" },
            { v: "available", label: "Disponibles" },
            { v: "coming_soon", label: "À venir" },
          ].map((f) => (
            <button
              key={f.v}
              onClick={() => setStatusFilter(f.v as any)}
              className={`border px-4 py-2 text-xs uppercase tracking-[0.2em] transition-colors ${
                statusFilter === f.v
                  ? "border-gold bg-gold text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-gold hover:text-gold"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-24 text-center text-muted-foreground">Aucun produit trouvé.</p>
      ) : (
        <div className="overflow-hidden border border-border">
          <table className="w-full text-sm">
            <thead className="bg-card text-left text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <tr>
                <th className="p-3">Produit</th>
                <th className="p-3">Catégorie</th>
                <th className="p-3">Prix vente</th>
                <th className="p-3">Prix achat</th>
                <th className="p-3">Marge</th>
                <th className="p-3">Stock</th>
                <th className="p-3">État</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((p) => {
                const cat = categories.find((c) => c.id === p.category_id);
                return (
                  <tr key={p.id} className="hover:bg-card/40">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <img src={resolveImageUrl(p.image_url)} alt={p.name} className="h-12 w-12 object-cover" />
                        <div>
                          <p className="font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">/{p.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">{cat?.name ?? "—"}</td>
                    <td className="p-3">${Number(p.price).toFixed(2)}</td>
                    <td className="p-3 text-muted-foreground">
                      {Number(p.purchase_price) > 0
                        ? `$${Number(p.purchase_price).toFixed(2)}`
                        : <span className="text-muted-foreground/50">—</span>}
                    </td>
                    <td className="p-3">
                      {(() => {
                        const cost = Number(p.purchase_price);
                        const sell = Number(p.price);
                        if (cost <= 0 || sell <= 0) return <span className="text-muted-foreground/50">—</span>;
                        const margin = sell - cost;
                        const pct = (margin / sell) * 100;
                        return (
                          <span className={margin > 0 ? "text-emerald-400" : "text-destructive"}>
                            ${margin.toFixed(2)}
                            <span className="ml-1 text-[10px] text-muted-foreground">({pct.toFixed(0)} %)</span>
                          </span>
                        );
                      })()}
                    </td>
                    <td className="p-3">
                      {p.has_sizes
                        ? p.sizes.reduce((s, x) => s + x.stock, 0) + " (tailles)"
                        : p.stock}
                    </td>
                    <td className="p-3">
                      {p.status === "available" ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Disponible
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-gold">
                          <Hourglass className="h-3.5 w-3.5" /> À venir
                        </span>
                      )}
                      {!p.is_active && (
                        <span className="ml-2 text-[11px] uppercase text-muted-foreground">(masqué)</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          to="/admin/products/$id"
                          params={{ id: String(p.id) }}
                          className="inline-flex h-8 w-8 items-center justify-center border border-border text-muted-foreground hover:border-gold hover:text-gold"
                          title="Modifier"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          onClick={() => remove(p)}
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
