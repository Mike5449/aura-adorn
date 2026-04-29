import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/context/CartContext";
import { Minus, Plus, ShieldCheck, Truck, RefreshCw, Hourglass } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import { categoryApi, productApi, ApiError, resolveImageUrl } from "@/lib/api";
import { toProduct, formatUsd } from "@/lib/api-types";
import { toast } from "sonner";

export const Route = createFileRoute("/product/$id")({
  loader: async ({ params }) => {
    let apiProduct;
    try {
      apiProduct = await productApi.getBySlug(params.id);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) throw notFound();
      throw e;
    }
    const [allProducts, categories] = await Promise.all([
      productApi.list({ active_only: true }).catch(() => []),
      categoryApi.list().catch(() => []),
    ]);
    const product = toProduct(apiProduct, categories);
    const related = allProducts
      .filter((p) => p.section === product.section && p.slug !== product.id)
      .slice(0, 4)
      .map((p) => toProduct(p, categories));
    return { product, related };
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [
      { title: `${loaderData.product.name} — Beauté & Élégance` },
      { name: "description", content: loaderData.product.description },
      { property: "og:title", content: loaderData.product.name },
      { property: "og:description", content: loaderData.product.description },
      { property: "og:image", content: loaderData.product.image },
      { name: "twitter:image", content: loaderData.product.image },
    ] : [],
  }),
  notFoundComponent: () => (
    <div className="py-32 text-center">
      <h1 className="font-display text-3xl">Produit introuvable</h1>
      <Link to="/shop" className="mt-6 inline-block text-gold underline">Retour à la boutique</Link>
    </div>
  ),
  component: ProductPage,
});

function ProductPage() {
  const { product, related } = Route.useLoaderData();
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const [sizeId, setSizeId] = useState<number | null>(null);

  const comingSoon = product.status === "coming_soon";
  const requiresSize = product.hasSizes;
  const availableSizes = product.sizes.filter((s) => s.is_active);

  const handleAdd = () => {
    if (comingSoon) {
      toast.info("Ce produit n'est pas encore disponible.");
      return;
    }
    if (requiresSize && sizeId == null) {
      toast.error("Veuillez choisir une taille.");
      return;
    }
    const size = availableSizes.find((s) => s.id === sizeId);
    if (size && size.stock < qty) {
      toast.error(`Stock insuffisant — ${size.stock} unité(s) disponible(s).`);
      return;
    }
    add(product, qty, size?.id, size?.size_label);
    toast.success("Ajouté au panier");
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <nav className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        <Link to="/" className="hover:text-gold">Accueil</Link>
        <span className="mx-2">/</span>
        <Link to="/shop" className="hover:text-gold">Boutique</Link>
        <span className="mx-2">/</span>
        <span className="text-gold">{product.name}</span>
      </nav>

      <div className="mt-10 grid gap-12 lg:grid-cols-2">
        <div className="relative bg-onyx">
          <img src={resolveImageUrl(product.image)} alt={product.name} width={800} height={800} className="h-full w-full object-cover" />
          {comingSoon && (
            <span className="absolute left-4 top-4 inline-flex items-center gap-2 border border-gold/60 bg-background/90 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-gold">
              <Hourglass className="h-3.5 w-3.5" /> À venir
            </span>
          )}
        </div>

        <div className="flex flex-col justify-center">
          <span className="text-xs uppercase tracking-[0.3em] text-gold">{product.categoryName ?? product.category}</span>
          <h1 className="mt-3 font-display text-4xl md:text-5xl">{product.name}</h1>

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="text-2xl text-gold">{formatUsd(product.price * qty)}</p>
            {qty > 1 && (
              <span className="text-xs text-muted-foreground">
                {formatUsd(product.price)} × {qty}
              </span>
            )}
            {comingSoon ? (
              <span className="border border-gold/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-gold">
                Bientôt disponible
              </span>
            ) : (
              <span className="border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                Disponible
              </span>
            )}
          </div>

          <div className="gold-divider my-8" />
          <p className="text-base leading-relaxed text-muted-foreground">{product.description}</p>

          {requiresSize && (
            <div className="mt-10">
              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-xs uppercase tracking-[0.3em] text-gold">Choisissez votre taille</span>
                {sizeId && (
                  <span className="text-xs text-muted-foreground">
                    Taille sélectionnée : <strong className="text-foreground">
                      {availableSizes.find((s) => s.id === sizeId)?.size_label}
                    </strong>
                  </span>
                )}
              </div>
              <p className="mb-4 text-xs text-muted-foreground">
                Sélectionnez le numéro qui correspond au tour de votre doigt.
              </p>
              {availableSizes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune taille disponible pour le moment.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availableSizes.map((s) => {
                    const oos = s.stock <= 0;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        disabled={oos || comingSoon}
                        onClick={() => setSizeId(s.id)}
                        className={`min-w-[56px] border px-4 py-2 text-sm transition-colors ${
                          sizeId === s.id
                            ? "border-gold bg-gold text-primary-foreground"
                            : oos
                              ? "cursor-not-allowed border-border/40 text-muted-foreground/50 line-through"
                              : "border-border hover:border-gold hover:text-gold"
                        }`}
                        title={oos ? "Rupture de stock" : `${s.stock} disponible(s)`}
                      >
                        {s.size_label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="mt-10 flex items-center gap-6">
            <div className="flex items-center border border-border">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="flex h-12 w-12 items-center justify-center hover:text-gold" aria-label="Diminuer">
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-12 text-center">{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} className="flex h-12 w-12 items-center justify-center hover:text-gold" aria-label="Augmenter">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <Button
              variant="luxe"
              size="xl"
              className="flex-1"
              disabled={comingSoon}
              onClick={handleAdd}
            >
              {comingSoon ? "Bientôt disponible" : "Ajouter au Panier"}
            </Button>
          </div>

          <ul className="mt-10 space-y-3 border-t border-border pt-8 text-sm text-muted-foreground">
            <li className="flex items-center gap-3"><Truck className="h-4 w-4 text-gold" /> Livraison express offerte</li>
            <li className="flex items-center gap-3"><RefreshCw className="h-4 w-4 text-gold" /> Retours sous 30 jours, sans condition</li>
            <li className="flex items-center gap-3"><ShieldCheck className="h-4 w-4 text-gold" /> Paiement sécurisé via MonCash</li>
          </ul>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-32">
          <h2 className="mb-10 text-center font-display text-3xl md:text-4xl">Vous Aimerez Aussi</h2>
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-6 sm:gap-y-12 md:grid-cols-4">
            {related.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}
