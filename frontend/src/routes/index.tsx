import { createFileRoute, Link } from "@tanstack/react-router";
import hero from "@/assets/hero.jpg";
import jewelryImg from "@/assets/cat-jewelry.jpg";
import beautyImg from "@/assets/cat-beauty.jpg";
import { Button } from "@/components/ui/button";
import ProductCard from "@/components/ProductCard";
import { categoryApi, productApi } from "@/lib/api";
import { toProduct } from "@/lib/api-types";
import { ShieldCheck, Truck, Sparkles, Lock, Star } from "lucide-react";

export const Route = createFileRoute("/")({
  loader: async () => {
    const [products, categories] = await Promise.all([
      productApi.list({ active_only: true }).catch(() => []),
      categoryApi.list().catch(() => []),
    ]);
    return {
      products: products.map((p) => toProduct(p, categories)),
    };
  },
  head: () => ({
    meta: [
      { title: "Beauté & Élégance — Bijoux, Maquillage & Soin de la Peau" },
      { name: "description", content: "Beauté & Élégance : bijoux précieux, maquillage haute pigmentation et soins de la peau. L'art complet de se mettre en valeur." },
      { property: "og:title", content: "Beauté & Élégance — Bijoux & Beauté" },
      { property: "og:description", content: "Bijoux, maquillage et soin de la peau de qualité." },
      { property: "og:image", content: hero },
      { name: "twitter:image", content: hero },
    ],
  }),
  component: Index,
});

function Index() {
  const { products } = Route.useLoaderData();
  const hommeFeatured = products
    .filter((p) => p.section === "homme" && p.bestseller)
    .slice(0, 4);
  const femmeFeatured = products
    .filter((p) => p.section === "femme" && p.bestseller)
    .slice(0, 4);

  return (
    <>
      {/* HERO */}
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <img src={hero} alt="" width={1920} height={1080} className="h-full w-full object-cover opacity-70" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        </div>

        <div className="mx-auto flex min-h-[88vh] max-w-7xl flex-col justify-center px-6 py-24">
          <span className="animate-[fade-in_0.6s_ease-out] text-xs uppercase tracking-[0.4em] text-gold">
            ◆ Collection Beauté &amp; Élégance 2026
          </span>
          <h1 className="mt-6 max-w-3xl animate-[fade-up_0.7s_cubic-bezier(0.22,1,0.36,1)] font-display text-5xl font-medium leading-[1.05] md:text-7xl lg:text-8xl">
            Élevez Votre Style.<br />
            <span className="shimmer-text italic">Affirmez</span> Votre Présence.
          </h1>
          <p className="mt-8 max-w-xl animate-[fade-up_0.9s_cubic-bezier(0.22,1,0.36,1)] text-lg leading-relaxed text-muted-foreground">
            Découvrez bijoux pour homme premium et essentiels beauté de luxe. Conçus pour la confiance, dessinés pour l'élégance.
          </p>
          <div className="mt-12 flex flex-wrap gap-4">
            <Button variant="luxe" size="xl" asChild>
              <Link to="/shop">Acheter Maintenant</Link>
            </Button>
            <Button variant="outlineGold" size="xl" asChild>
              <Link to="/shop">Explorer la Collection</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* CATÉGORIES */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="mb-14 text-center">
          <span className="text-xs uppercase tracking-[0.4em] text-gold">Deux univers, une signature</span>
          <h2 className="mt-4 font-display text-4xl md:text-5xl">Nos Collections</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-6">
          {[
            { img: jewelryImg, title: "Homme", sub: "Bijoux · Parfums · Maillots", section: "homme" as const },
            { img: beautyImg, title: "Femme", sub: "Bijoux · Beauté & Maquillage", section: "femme" as const },
          ].map((c) => (
            <Link
              key={c.section}
              to="/shop"
              search={{ section: c.section, group: "all", category: "all" }}
              className="group relative block aspect-[4/5] overflow-hidden bg-onyx md:aspect-[5/6]"
            >
              <img src={c.img} alt={c.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-8 md:p-10">
                <span className="text-[10px] uppercase tracking-[0.25em] text-gold sm:text-xs sm:tracking-[0.3em]">{c.sub}</span>
                <h3 className="mt-2 font-display text-xl leading-tight sm:mt-3 sm:text-3xl md:text-4xl lg:text-5xl">{c.title}</h3>
                <span className="mt-3 inline-block border-b border-gold pb-1 text-[10px] uppercase tracking-[0.2em] text-gold transition-all group-hover:tracking-[0.3em] sm:mt-6 sm:text-xs sm:tracking-[0.25em] sm:group-hover:tracking-[0.35em]">
                  Découvrir →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* HOMME */}
      <section className="border-y border-border/40 bg-card/30 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-14 flex items-end justify-between gap-6">
            <div>
              <span className="text-xs uppercase tracking-[0.4em] text-gold">Pour Lui</span>
              <h2 className="mt-4 font-display text-4xl md:text-5xl">Homme</h2>
              <p className="mt-3 max-w-xl text-muted-foreground">Bijoux, parfums et maillots. Force, raffinement et caractère.</p>
            </div>
            <Link to="/shop" search={{ section: "homme", group: "all", category: "all" }} className="hidden text-xs uppercase tracking-[0.25em] text-gold hover:text-foreground md:inline-block">
              Voir tout →
            </Link>
          </div>
          {hommeFeatured.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">Aucun produit pour le moment.</p>
          ) : (
            <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-6 sm:gap-y-12 md:grid-cols-4">
              {hommeFeatured.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
          <div className="mt-10 text-center md:hidden">
            <Button variant="outlineGold" size="lg" asChild>
              <Link to="/shop" search={{ section: "homme", group: "all", category: "all" }}>
                Voir tous les produits Homme →
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* FEMME */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="mb-14 flex items-end justify-between gap-6">
          <div>
            <span className="text-xs uppercase tracking-[0.4em] text-gold">Pour Elle</span>
            <h2 className="mt-4 font-display text-4xl md:text-5xl">Femme</h2>
            <p className="mt-3 max-w-xl text-muted-foreground">
              <span className="italic text-foreground">« Votre peau est votre identité. »</span><br />
              Bijoux, soins de la peau et maquillage de qualité, pour révéler votre beauté naturelle et gagner en confiance.
            </p>
          </div>
          <Link to="/shop" search={{ section: "femme", group: "all", category: "all" }} className="hidden text-xs uppercase tracking-[0.25em] text-gold hover:text-foreground md:inline-block">
            Voir tout →
          </Link>
        </div>
        {femmeFeatured.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">Aucun produit pour le moment.</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-6 sm:gap-y-12 md:grid-cols-4">
            {femmeFeatured.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
        <div className="mt-10 text-center md:hidden">
          <Button variant="outlineGold" size="lg" asChild>
            <Link to="/shop" search={{ section: "femme", group: "all", category: "all" }}>
              Voir tous les produits Femme →
            </Link>
          </Button>
        </div>
      </section>

      {/* POURQUOI NOUS */}
      <section className="border-y border-border/40 bg-card/40 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-14 text-center">
            <span className="text-xs uppercase tracking-[0.4em] text-gold">La Promesse Beauté &amp; Élégance</span>
            <h2 className="mt-4 font-display text-4xl md:text-5xl">Pourquoi Nous Choisir ?</h2>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-8 md:grid-cols-2 lg:grid-cols-4">
            {[
              { Icon: Sparkles, title: "Qualité Premium", desc: "Pièces finies à la main et formules haut de gamme uniquement." },
              { Icon: ShieldCheck, title: "Vous Met en Valeur", desc: "Des pièces choisies pour révéler votre style et magnifier votre présence." },
              { Icon: Truck, title: "Livraison à Domicile", desc: "Livraison rapide à Delmas, soigneusement emballée jusqu'à votre porte." },
              { Icon: Lock, title: "Paiement MonCash", desc: "Réglez en toute simplicité depuis votre compte MonCash Digicel." },
            ].map(({ Icon, title, desc }) => (
              <div key={title} className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center border border-gold/40 text-gold">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-6 font-display text-xl">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TÉMOIGNAGES */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="mb-14 text-center">
          <span className="text-xs uppercase tracking-[0.4em] text-gold">Adorée Partout</span>
          <h2 className="mt-4 font-display text-4xl md:text-5xl">Paroles de Clients</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-3">
          {[
            { name: "Alexandre R.", role: "Port-au-Prince, HT", quote: "La chevalière est exquise — lourde, audacieuse et d'une élégance impossible. Beauté & Élégance a redéfini ce qu'est le luxe pour moi." },
            { name: "Sofia M.", role: "Pétion-Ville, HT", quote: "La palette Noir est la plus pigmentée que j'aie jamais possédée. L'écrin seul est un cadeau qu'on s'offre." },
            { name: "James T.", role: "Cap-Haïtien, HT", quote: "De la chaîne à la montre, chaque pièce est arrivée impeccable. C'est désormais ma référence pour chaque cadeau." },
          ].map((t) => (
            <figure key={t.name} className="border border-border bg-card p-4 transition-colors hover:border-gold/60 sm:p-6 md:p-8">
              <div className="flex gap-0.5 text-gold sm:gap-1">
                {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-current sm:h-4 sm:w-4" />)}
              </div>
              <blockquote className="mt-3 text-sm leading-relaxed text-foreground/90 sm:mt-5 sm:text-base">« {t.quote} »</blockquote>
              <figcaption className="mt-4 border-t border-border pt-3 sm:mt-6 sm:pt-4">
                <p className="text-xs font-medium sm:text-sm">{t.name}</p>
                <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground sm:text-xs sm:tracking-[0.2em]">{t.role}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="relative overflow-hidden border border-gold/30 bg-card px-8 py-20 text-center md:px-16">
          <div className="absolute inset-0 -z-10 opacity-40" style={{ background: "radial-gradient(circle at center, var(--gold) 0%, transparent 60%)" }} />
          <span className="text-xs uppercase tracking-[0.4em] text-gold">Privilèges Membres</span>
          <h2 className="mt-4 font-display text-4xl md:text-5xl">Rejoignez le Cercle Beauté &amp; Élégance</h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">Accès anticipé aux nouveautés, offres privées et livraison express offerte.</p>
          <form className="mx-auto mt-8 flex max-w-md gap-2">
            <input type="email" required placeholder="votre@email.com" className="flex-1 border border-border bg-background px-4 py-3 text-sm focus:border-gold focus:outline-none" />
            <Button type="submit" variant="luxe" size="lg">Rejoindre</Button>
          </form>
        </div>
      </section>
    </>
  );
}
