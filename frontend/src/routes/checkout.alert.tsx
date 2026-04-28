import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { AlertTriangle, MessageCircleQuestion, RotateCcw, ShoppingBag } from "lucide-react";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";

const searchSchema = z.object({
  reason: fallback(z.string(), "").default(""),
  order: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/checkout/alert")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Paiement non confirmé — Carat & Couleur" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AlertPage,
});

const HUMAN_REASONS: Record<string, string> = {
  cancelled: "Vous avez annulé le paiement avant la confirmation.",
  timeout: "La session de paiement a expiré sans confirmation.",
  insufficient_funds: "Le solde de votre compte MonCash est insuffisant.",
  invalid_transaction: "La transaction n'a pas pu être validée par MonCash.",
  network: "Une erreur réseau a interrompu la vérification.",
  missing_params: "Identifiants de paiement manquants au retour.",
};

function AlertPage() {
  const { reason, order } = Route.useSearch();

  const friendlyReason = HUMAN_REASONS[reason] || reason || (
    "Le paiement n'a pas pu être confirmé. Aucun montant n'a été débité — vous pouvez réessayer."
  );

  return (
    <div className="mx-auto max-w-2xl px-6 py-24">
      <div className="text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-amber-500/40 bg-amber-500/10">
          <AlertTriangle className="h-12 w-12 text-amber-500" />
        </div>
        <span className="mt-6 inline-block text-xs uppercase tracking-[0.4em] text-amber-400">
          Attention — Paiement non confirmé
        </span>
        <h1 className="mt-3 font-display text-4xl md:text-5xl">Quelque chose s'est mal passé</h1>
        <p className="mt-4 text-base text-muted-foreground">
          {friendlyReason}
        </p>
      </div>

      <div className="mx-auto my-10 max-w-md border border-amber-500/30 bg-amber-500/5 p-6 text-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-amber-400">Bon à savoir</p>
        <ul className="mt-3 space-y-2 text-muted-foreground">
          <li>• Aucun montant ne sera débité tant que MonCash n'a pas confirmé la transaction.</li>
          <li>• Si vous avez été débité par erreur, le montant sera remboursé sous 48 h.</li>
          <li>• Vous pouvez relancer le paiement à tout moment depuis votre panier.</li>
        </ul>
      </div>

      {order && (
        <div className="mx-auto mb-8 max-w-md border border-border bg-card p-6 text-center">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Référence interne</p>
          <p className="mt-1 font-mono text-sm text-gold">{order}</p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Communiquez ce numéro au support si vous nous contactez.
          </p>
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="luxe" size="xl" asChild>
          <Link to="/cart">
            <RotateCcw className="mr-2 h-4 w-4" /> Réessayer le paiement
          </Link>
        </Button>
        <Button variant="outlineGold" size="xl" asChild>
          <Link to="/contact">
            <MessageCircleQuestion className="mr-2 h-4 w-4" /> Contacter le support
          </Link>
        </Button>
        <Button variant="ghost" size="xl" asChild>
          <Link to="/shop">
            <ShoppingBag className="mr-2 h-4 w-4" /> Continuer la visite
          </Link>
        </Button>
      </div>
    </div>
  );
}
