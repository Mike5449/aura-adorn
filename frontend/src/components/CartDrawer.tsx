import { useCart } from "@/context/CartContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Minus, Plus, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { formatUsd } from "@/lib/api-types";
import { resolveImageUrl } from "@/lib/api";

export default function CartDrawer() {
  const { items, open, setOpen, setQty, remove, total, keyOf } = useCart();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="flex w-full flex-col bg-card sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl tracking-wide">Mon Panier</SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Votre panier est vide</p>
            <Button variant="outlineGold" size="lg" onClick={() => setOpen(false)} asChild>
              <Link to="/shop">Découvrir la collection</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto py-6">
              <ul className="space-y-6">
                {items.map((item) => {
                  const key = keyOf(item);
                  const { product, qty, selectedSizeLabel, selectedColorLabel } = item;
                  return (
                    <li key={key} className="flex gap-4">
                      <img src={resolveImageUrl(product.image)} alt={product.name} className="h-24 w-24 shrink-0 object-cover" />
                      <div className="flex flex-1 flex-col">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium">{product.name}</p>
                          <button onClick={() => remove(key)} aria-label="Retirer" className="text-muted-foreground hover:text-gold">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <span className="mt-1 text-xs uppercase tracking-widest text-gold">{formatUsd(product.price)}</span>
                        {selectedSizeLabel && (
                          <span className="mt-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                            Taille : {selectedSizeLabel}
                          </span>
                        )}
                        {selectedColorLabel && (
                          <span className="mt-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                            Couleur : {selectedColorLabel}
                          </span>
                        )}
                        <div className="mt-auto flex items-center gap-3">
                          <button onClick={() => setQty(key, qty - 1)} className="flex h-7 w-7 items-center justify-center border border-border hover:border-gold" aria-label="Diminuer">
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-6 text-center text-sm">{qty}</span>
                          <button onClick={() => setQty(key, qty + 1)} className="flex h-7 w-7 items-center justify-center border border-border hover:border-gold" aria-label="Augmenter">
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="border-t border-border pt-6">
              <div className="flex items-center justify-between text-sm uppercase tracking-[0.2em]">
                <span className="text-muted-foreground">Sous-total</span>
                <span className="text-gold">{formatUsd(total)}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Conversion en gourdes & livraison calculées à la commande.
              </p>
              <Button variant="luxe" size="xl" className="mt-6 w-full" asChild onClick={() => setOpen(false)}>
                <Link to="/cart">Commander</Link>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
