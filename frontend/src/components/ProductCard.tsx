import { Link, useNavigate } from "@tanstack/react-router";
import { Product } from "@/data/products";
import { formatUsd } from "@/lib/api-types";
import { useCart } from "@/context/CartContext";
import { resolveImageUrl } from "@/lib/api";
import { Hourglass, ShoppingBag, Star } from "lucide-react";
import { toast } from "sonner";

// Deterministic pseudo-rating per product so cards look populated until
// real reviews are wired up. Same slug → same rating, no flicker.
function ratingFor(slug: string): { value: number; count: number } {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  const value = 4.2 + ((h % 80) / 100); // 4.20 — 4.99
  const count = 18 + (h % 320);          // 18 — 337
  return { value, count };
}

function Stars({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <div className="relative inline-flex" aria-label={`${value.toFixed(1)} sur 5`}>
      <div className="flex gap-0.5 text-muted-foreground/30">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className="h-3 w-3" />
        ))}
      </div>
      <div
        className="pointer-events-none absolute inset-y-0 left-0 flex gap-0.5 overflow-hidden text-gold"
        style={{ width: `${pct}%` }}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className="h-3 w-3 fill-current" />
        ))}
      </div>
    </div>
  );
}

export default function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  const navigate = useNavigate();
  const comingSoon = product.status === "coming_soon";
  const requiresSize = product.hasSizes;
  const { value: rating, count: reviews } = ratingFor(product.id);

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (comingSoon) {
      toast.info("Bientôt disponible — restez à l'écoute.");
      return;
    }
    if (requiresSize) {
      navigate({ to: "/product/$id", params: { id: product.id } });
      return;
    }
    add(product);
  };

  return (
    <article className="group relative flex flex-col overflow-hidden border border-border/40 bg-card/40 transition-all duration-300 hover:-translate-y-1 hover:border-gold/60 hover:shadow-[0_8px_30px_rgba(212,175,55,0.12)]">
      {/* Image */}
      <Link
        to="/product/$id"
        params={{ id: product.id }}
        className="relative block aspect-square overflow-hidden bg-onyx"
      >
        <img
          src={resolveImageUrl(product.image)}
          alt={product.name}
          loading="lazy"
          width={800}
          height={800}
          className={`h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 ${
            comingSoon ? "opacity-70" : ""
          }`}
        />

        {/* Badges */}
        <div className="absolute left-3 top-3 z-10 flex flex-col gap-1.5">
          {product.bestseller && !comingSoon && (
            <span className="bg-gold px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-primary-foreground">
              Best-Seller
            </span>
          )}
          {comingSoon && (
            <span className="border border-gold/60 bg-background/80 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-gold">
              À venir
            </span>
          )}
        </div>

        {/* Subtle bottom gradient on hover */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/40 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      </Link>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <span className="text-[10px] uppercase tracking-[0.3em] text-gold/80">
          {product.categoryName ?? product.category}
        </span>

        <Link
          to="/product/$id"
          params={{ id: product.id }}
          className="line-clamp-2 text-sm font-medium leading-snug text-foreground transition-colors hover:text-gold"
        >
          {product.name}
        </Link>

        {/* Rating */}
        <div className="flex items-center gap-1.5">
          <Stars value={rating} />
          <span className="text-[10px] text-muted-foreground">
            {rating.toFixed(1)} <span className="text-muted-foreground/60">({reviews})</span>
          </span>
        </div>

        {/* Description snippet */}
        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground/80">
          {product.description}
        </p>

        {/* Price + cart icon */}
        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
          <span className="text-base font-semibold text-gold">
            {formatUsd(product.price)}
          </span>
          <button
            type="button"
            onClick={handleAdd}
            disabled={comingSoon}
            aria-label={
              comingSoon
                ? "Bientôt disponible"
                : requiresSize
                  ? "Choisir une taille"
                  : "Ajouter au panier"
            }
            title={
              comingSoon
                ? "Bientôt disponible"
                : requiresSize
                  ? "Choisir une taille"
                  : "Ajouter au panier"
            }
            className={`group/btn inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all ${
              comingSoon
                ? "cursor-not-allowed border-border/40 text-muted-foreground/40"
                : "border-gold/40 text-gold hover:bg-gold hover:text-primary-foreground hover:scale-110"
            }`}
          >
            {comingSoon ? (
              <Hourglass className="h-4 w-4" />
            ) : (
              <ShoppingBag className="h-4 w-4 transition-transform" />
            )}
          </button>
        </div>
      </div>
    </article>
  );
}
