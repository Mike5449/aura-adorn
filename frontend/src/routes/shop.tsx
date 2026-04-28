import { createFileRoute, Link } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import ProductCard from "@/components/ProductCard";
import { categoryApi, productApi } from "@/lib/api";
import { toProduct, type Section } from "@/lib/api-types";

const searchSchema = z.object({
  section: fallback(z.enum(["all", "jewelry", "beauty"]), "all").default("all"),
  category: fallback(z.string(), "all").default("all"),
});

export const Route = createFileRoute("/shop")({
  validateSearch: zodValidator(searchSchema),
  loader: async () => {
    const [products, categories] = await Promise.all([
      productApi.list({ active_only: true }).catch(() => []),
      categoryApi.list().catch(() => []),
    ]);
    return {
      products: products.map((p) => toProduct(p, categories)),
      categories,
    };
  },
  head: () => ({
    meta: [
      { title: "Boutique — Beauté & Élégance" },
      { name: "description", content: "Découvrez notre collection complète : bijoux, maquillage et soin de la peau." },
      { property: "og:title", content: "Boutique — Beauté & Élégance" },
      { property: "og:description", content: "Bijoux, maquillage et skincare." },
    ],
  }),
  component: Shop,
});

type SectionFilter = "all" | Section;

const sectionFilters: { label: string; value: SectionFilter }[] = [
  { label: "Tout", value: "all" },
  { label: "Bijoux Homme", value: "jewelry" },
  { label: "Beauté", value: "beauty" },
];

function Shop() {
  const { products, categories } = Route.useLoaderData();
  const { section, category } = Route.useSearch();

  const cats = [
    { label: "Tout", value: "all" },
    ...categories
      .filter((c) => section === "all" || c.section === section)
      .sort((a, b) => a.section.localeCompare(b.section) || a.display_order - b.display_order)
      .map((c) => ({ label: c.name, value: c.slug })),
  ];

  const filtered = products.filter((p) => {
    if (section !== "all" && p.section !== section) return false;
    if (category !== "all" && p.category !== category) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <div className="text-center">
        <span className="text-xs uppercase tracking-[0.4em] text-gold">La Collection</span>
        <h1 className="mt-4 font-display text-5xl md:text-6xl">La Boutique</h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Bijoux pour homme et beauté d'exception, pour ceux qui défient le temps.
        </p>
      </div>

      <div className="mt-12 flex flex-col items-center gap-4">
        <div className="flex flex-wrap justify-center gap-2">
          {sectionFilters.map((f) => (
            <Link
              key={f.value}
              to="/shop"
              search={{ section: f.value, category: "all" }}
              className={`border px-6 py-2 text-xs uppercase tracking-[0.2em] transition-colors ${
                section === f.value
                  ? "border-gold bg-gold text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-gold hover:text-gold"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>
        {cats.length > 1 && (
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {cats.map((c) => (
              <Link
                key={c.value}
                to="/shop"
                search={{ section, category: c.value }}
                className={`text-xs uppercase tracking-[0.2em] transition-colors ${
                  category === c.value ? "text-gold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {c.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="gold-divider mt-10" />

      {filtered.length === 0 ? (
        <p className="py-32 text-center text-muted-foreground">Aucun produit ne correspond à cette sélection.</p>
      ) : (
        <div className="mt-14 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-6 sm:gap-y-12 md:grid-cols-4">
          {filtered.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
}
