import { Link } from "@tanstack/react-router";
import { Instagram, Facebook, Twitter } from "lucide-react";
import Logo from "@/components/Logo";

export default function Footer() {
  return (
    <footer className="mt-32 border-t border-border/40 bg-card">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-12 md:grid-cols-4">
          <div>
            <Logo size="md" asLink={false} />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Bijoux, maquillage et soin de la peau. La Beauté pour révéler, l'Élégance pour affirmer — l'art complet de se mettre en valeur.
            </p>
            <div className="mt-6 flex gap-4">
              {[Instagram, Facebook, Twitter].map((Icon, i) => (
                <a key={i} href="#" aria-label="Réseau social" className="text-muted-foreground transition-colors hover:text-gold">
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {[
            { title: "Boutique", links: [{ l: "Tous les produits", to: "/shop" }, { l: "Bijoux Homme", to: "/shop" }, { l: "Beauté", to: "/shop" }, { l: "Best-sellers", to: "/shop" }] },
            { title: "Support", links: [{ l: "Nous contacter", to: "/contact" }, { l: "Livraison", to: "/contact" }, { l: "Retours", to: "/contact" }, { l: "FAQ", to: "/contact" }] },
            { title: "À Propos", links: [{ l: "Notre histoire", to: "/" }, { l: "Engagement", to: "/" }, { l: "Presse", to: "/" }, { l: "Carrières", to: "/" }] },
          ].map((col) => (
            <div key={col.title}>
              <h4 className="mb-4 text-xs uppercase tracking-[0.25em] text-gold">{col.title}</h4>
              <ul className="space-y-3">
                {col.links.map((l) => (
                  <li key={l.l}>
                    <Link to={l.to} className="text-sm text-muted-foreground transition-colors hover:text-foreground">{l.l}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="gold-divider mt-16" />
        <p className="mt-8 text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
          © {new Date().getFullYear()} Beauté &amp; Élégance — Façonné avec passion
        </p>
      </div>
    </footer>
  );
}
