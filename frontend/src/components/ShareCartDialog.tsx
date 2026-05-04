import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, MailIcon, MessageCircle, Share2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buildShareMessage, buildShareUrl } from "@/lib/cart-share";
import type { CartItem } from "@/context/CartContext";

const WHATSAPP_PHONE = "50934705170"; // E.164 sans le « + »

/**
 * Modal that lets the customer share their cart on multiple channels
 * (copy link, WhatsApp, email, native share). Reused by the full cart
 * page and the slide-over drawer so the experience is identical from
 * either entry point.
 */
export default function ShareCartDialog({
  items,
  onClose,
}: {
  items: CartItem[];
  onClose: () => void;
}) {
  const shareUrl = useMemo(() => buildShareUrl(items), [items]);
  const shareMessage = useMemo(() => buildShareMessage(items, shareUrl), [items, shareUrl]);
  const [copied, setCopied] = useState(false);
  const canNativeShare =
    typeof navigator !== "undefined" && typeof (navigator as any).share === "function";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Lien copié dans le presse-papiers.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Impossible de copier — sélectionnez et copiez manuellement.");
    }
  };

  const shareWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const shareWhatsAppToBrand = () => {
    const url = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(shareMessage)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const shareEmail = () => {
    const subject = "Mon panier — Beauté & Élégance";
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(shareMessage)}`;
    window.location.href = url;
  };

  const shareNative = async () => {
    try {
      await (navigator as any).share({
        title: "Mon panier — Beauté & Élégance",
        text: shareMessage,
        url: shareUrl,
      });
    } catch {
      /* user cancelled or unsupported — silent */
    }
  };

  // Lock body scroll + close on Escape while the dialog is open.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevPointerEvents = document.body.style.pointerEvents;
    document.body.style.overflow = "hidden";
    // Some Radix-based parents (Sheet/Dialog) flip body to pointer-events:none —
    // force it back so the portal-rendered dialog stays clickable.
    document.body.style.pointerEvents = "auto";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.pointerEvents = prevPointerEvents;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Portal target — only available on the client.
  if (typeof document === "undefined") return null;

  const dialog = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Partager mon panier"
      style={{ pointerEvents: "auto" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md border border-border bg-card p-6 shadow-luxe"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-gold">Partager</p>
            <h2 className="mt-1 font-display text-2xl">Mon panier</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Quiconque ouvre ce lien retrouvera les mêmes articles dans son panier.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5">
          <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Lien partageable
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 truncate border border-border bg-background px-3 py-2 text-xs text-muted-foreground focus:border-gold focus:outline-none"
            />
            <Button
              type="button"
              variant={copied ? "default" : "luxe"}
              size="default"
              onClick={copyLink}
              className="shrink-0 gap-2"
            >
              {copied ? (
                <><Check className="h-4 w-4" /> Copié</>
              ) : (
                <><Copy className="h-4 w-4" /> Copier</>
              )}
            </Button>
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Ou partager via
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={shareWhatsApp}
              className="inline-flex items-center justify-center gap-2 border border-emerald-500/40 bg-emerald-500/5 px-3 py-2.5 text-sm transition-colors hover:bg-emerald-500/10"
            >
              <MessageCircle className="h-4 w-4 text-emerald-500" />
              WhatsApp
            </button>
            <button
              type="button"
              onClick={shareEmail}
              className="inline-flex items-center justify-center gap-2 border border-border bg-background px-3 py-2.5 text-sm transition-colors hover:border-gold"
            >
              <MailIcon className="h-4 w-4" />
              Email
            </button>
            <button
              type="button"
              onClick={shareWhatsAppToBrand}
              className="col-span-2 inline-flex items-center justify-center gap-2 border border-emerald-500/40 bg-emerald-500/5 px-3 py-2.5 text-sm transition-colors hover:bg-emerald-500/10"
            >
              <MessageCircle className="h-4 w-4 text-emerald-500" />
              Envoyer mon panier à Beauté & Élégance
            </button>
            {canNativeShare && (
              <button
                type="button"
                onClick={shareNative}
                className="col-span-2 inline-flex items-center justify-center gap-2 border border-border bg-background px-3 py-2.5 text-sm transition-colors hover:border-gold"
              >
                <Share2 className="h-4 w-4" />
                Autre application…
              </button>
            )}
          </div>
        </div>

        <p className="mt-5 text-[10px] leading-relaxed text-muted-foreground">
          Le lien encode uniquement les références produits (ID + quantité).
          Les prix sont vérifiés à l'ouverture par le destinataire — impossible
          de manipuler le lien pour modifier les montants.
        </p>
      </div>
    </div>
  );

  // Render at the document root so the dialog escapes any parent's
  // pointer-events / focus-trap (Radix Sheet, etc.).
  return createPortal(dialog, document.body);
}
