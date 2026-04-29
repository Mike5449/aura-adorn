import { createFileRoute, Link } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import ProductCard from "@/components/ProductCard";
import { categoryApi, productApi } from "@/lib/api";
import { toProduct, type ApiCategory, type Section } from "@/lib/api-types";

const searchSchema = z.object({
  section: fallback(z.enum(["all", "homme", "femme"]), "all").default("all"),
  // `group` = top-level category slug (e.g. bijoux-homme, beaute-femme).
  // `category` = leaf category slug (e.g. rings, face).
  group: fallback(z.string(), "all").default("all"),
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
      { name: "description", content: "Bijoux, parfums, maillots, maquillage et soin de la peau — l'art complet de se mettre en valeur." },
      { property: "og:title", content: "Boutique — Beauté & Élégance" },
      { property: "og:description", content: "Bijoux, parfums, maillots et beauté." },
    ],
  }),
  component: Shop,
});

type SectionFilter = "all" | Section;

const SECTIONS: { label: string; value: SectionFilter }[] = [
  { label: "Tout", value: "all" },
  { label: "Homme", value: "homme" },
  { label: "Femme", value: "femme" },
];

function Shop() {
  const { products, categories } = Route.useLoaderData();
  const { section, group, category } = Route.useSearch();

  // Top-level groups (parent_id null) for the active section
  const groups: ApiCategory[] = categories
    .filter((c) => c.parent_id === null)
    .filter((c) => section === "all" || c.section === section)
    .sort((a, b) => a.section.localeCompare(b.section) || a.display_order - b.display_order);

  // Leaves of the selected group (only when a group is picked)
  const selectedGroup = group !== "all"
    ? categories.find((c) => c.slug === group)
    : undefined;

  const leaves: ApiCategory[] = selectedGroup
    ? categories
        .filter((c) => c.parent_id === selectedGroup.id)
        .sort((a, b) => a.display_order - b.display_order)
    : [];

  // Apply filters
  const filtered = products.filter((p) => {
    if (section !== "all" && p.section !== section) return false;
    if (group !== "all") {
      // Product matches if its category is the group itself OR any child of the group
      if (selectedGroup) {
        const isGroup = p.categoryId === selectedGroup.id;
        const parent = categories.find((c) => c.id === p.categoryId);
        const isChildOfGroup = parent?.parent_id === selectedGroup.id;
        if (!isGroup && !isChildOfGroup) return false;
      }
    }
    if (category !== "all" && p.category !== category) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <div className="text-center">
        <span className="text-xs uppercase tracking-[0.4em] text-gold">La Collection</span>
        <h1 className="mt-4 font-display text-5xl md:text-6xl">La Boutique</h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Bijoux, parfums, maillots et beauté d'exception, pour celles et ceux qui définissent leur propre style.
        </p>
      </div>

      <div className="mt-12 flex flex-col items-center gap-4">
        {/* Level 1 — Section (Homme / Femme / Tout) */}
        <div className="flex flex-wrap justify-center gap-2">
          {SECTIONS.map((f) => (
            <Link
              key={f.value}
              to="/shop"
              search={{ section: f.value, group: "all", category: "all" }}
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

        {/* Level 2 — Top-level group (Bijoux, Parfums, Maillots, Beauté) */}
        {groups.length > 0 && (
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 px-2">
            <Link
              to="/shop"
              search={{ section, group: "all", category: "all" }}
              className={`text-xs uppercase tracking-[0.2em] transition-colors ${
                group === "all" ? "text-gold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Tous les rayons
            </Link>
            {groups.map((g) => (
              <Link
                key={g.id}
                to="/shop"
                search={{ section, group: g.slug, category: "all" }}
                className={`text-xs uppercase tracking-[0.2em] transition-colors ${
                  group === g.slug ? "text-gold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {section === "all" ? `${g.name} ${g.section === "homme" ? "♂" : "♀"}` : g.name}
              </Link>
            ))}
          </div>
        )}

        {/* Level 3 — Leaves of the selected group */}
        {leaves.length > 0 && (
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 border-t border-border/40 pt-3 px-2">
            <Link
              to="/shop"
              search={{ section, group, category: "all" }}
              className={`text-[11px] uppercase tracking-[0.2em] transition-colors ${
                category === "all" ? "text-gold" : "text-muted-foreground/70 hover:text-foreground"
              }`}
            >
              ◆ Tout {selectedGroup?.name}
            </Link>
            {leaves.map((c) => (
              <Link
                key={c.id}
                to="/shop"
                search={{ section, group, category: c.slug }}
                className={`text-[11px] uppercase tracking-[0.2em] transition-colors ${
                  category === c.slug ? "text-gold" : "text-muted-foreground/70 hover:text-foreground"
                }`}
              >
                {c.name}
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
