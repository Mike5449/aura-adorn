"""
Seed catalog: categories + a starter list of products.

Mirrors the static products that originally lived in the frontend
(`src/data/products.ts`) so the storefront keeps working when it
switches to the API.

Idempotent — re-running only inserts what's missing.

Usage (from the backend/ directory):
    python scripts/seed_catalog.py
"""
from __future__ import annotations

import os
import sys
from decimal import Decimal

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models.catalog import Category, Product, ProductSize


# Hierarchical catalog:
#   Section (homme | femme) → Group (top-level, parent_slug=None)
#                          → Leaf  (parent_slug=<group slug>)
#
# Tuple shape: (slug, name, section, display_order, parent_slug)
CATEGORIES = [
    # ============ HOMME ============
    # Top-level groups
    ("bijoux-homme",   "Bijoux",           "homme", 10, None),
    ("parfums-homme",  "Parfums",          "homme", 20, None),
    ("maillots-homme", "Maillot",          "homme", 30, None),
    # Bijoux leaves
    ("rings",     "Bagues",            "homme", 10, "bijoux-homme"),
    ("bracelets", "Bracelets",         "homme", 20, "bijoux-homme"),
    ("chains",    "Chaînes",           "homme", 30, "bijoux-homme"),
    ("watches",   "Montres",           "homme", 40, "bijoux-homme"),
    ("earrings",  "Boucles d'Oreille", "homme", 50, "bijoux-homme"),

    # ============ FEMME ============
    # Top-level groups
    ("bijoux-femme",   "Bijoux",     "femme", 10, None),
    ("beaute-femme",   "Beauté",     "femme", 20, None),
    # Beauté leaves (Stephie Beauty)
    ("face",  "Visage",          "femme", 10, "beaute-femme"),
    ("eyes",  "Yeux",            "femme", 20, "beaute-femme"),
    ("lips",  "Lèvres",          "femme", 30, "beaute-femme"),
    ("tools", "Accessoires",     "femme", 40, "beaute-femme"),
    ("kits",  "Kits & Coffrets", "femme", 50, "beaute-femme"),
]


# Default ring sizes (European). Used for any product where category=rings
# and `has_sizes=True`. Stock is generous so the storefront isn't blocked.
DEFAULT_RING_SIZES = ["48", "50", "52", "54", "56", "58", "60", "62", "64"]


# ---------------------------------------------------------------------------
# Helper — real beauty photos from Unsplash (free, royalty-free, verified to
# exist at seed time). Replace via the admin UI to push your own product photos.
# ---------------------------------------------------------------------------

def _u(photo_id: str) -> str:
    """Build an Unsplash CDN URL for a known photo id."""
    return (
        f"https://images.unsplash.com/photo-{photo_id}"
        "?w=800&q=80&auto=format&fit=crop"
    )


# Curated Unsplash photo ids — each one verified live before being added.
# Names below are descriptive; same id can be reused across similar products.
PHOTO = {
    "foundation_bottle":      "1556228720-195a672e8a03",
    "foundation_alt":         "1571875257727-256c39da42af",
    "cosmetics_flat":         "1596462502278-27bfdc403348",
    "cosmetics_close":        "1626806787461-102c1bfaaea1",
    "eyeshadow_palette":      "1522335789203-aabd1fc54bc9",
    "palette_luxe":           "1612548403247-aa2873e9422d",
    "eyeshadow_close":        "1607602132700-068258431c6c",
    "mascara":                "1571781926291-c477ebfd024b",
    "mascara_wand":           "1585652757173-57de5e9fab42",
    "mascara_alt":            "1573461160327-b450ce3d8e7f",
    "lipsticks_red_gold":     "1487412947147-5cebf100ffc2",
    "lipsticks_lineup":       "1586495777744-4413f21062fa",
    "lipstick_single":        "1503236823255-94609f598e71",
    "brushes_set":            "1612817288484-6f916006741a",
    "brushes_alt":            "1583241475880-083f84372725",
    "brushes_makeup":         "1620916566398-39f1143ab7be",
}


PRODUCTS = [
    # JEWELRY
    {
        "slug": "cuban-chain", "name": "Chaîne Maille Cubaine — Or 18K", "price": "489",
        "image_url": "/assets/p-chain.jpg", "category_slug": "chains",
        "is_bestseller": True, "status": "available", "stock": 25,
        "description": "Chaîne maille cubaine finie à la main en acier inoxydable plaqué or 18K. "
                       "Une affirmation de présence et de masculinité intemporelle.",
    },
    {
        "slug": "onyx-signet", "name": "Chevalière Onyx Noir", "price": "219",
        "image_url": "/assets/p-ring.jpg", "category_slug": "rings",
        "is_bestseller": True, "status": "available", "has_sizes": True,
        "description": "Chevalière audacieuse en onyx noir poli, sertie sur un anneau d'or sculpté. "
                       "Conçue pour l'homme qui mène.",
    },
    {
        "slug": "noir-watch", "name": "Montre Automatique Noir", "price": "749",
        "image_url": "/assets/p-watch.jpg", "category_slug": "watches",
        "is_bestseller": True, "status": "available", "stock": 12,
        "description": "Mouvement automatique, verre saphir, cadran noir profond cerclé d'or champagne. "
                       "L'autorité silencieuse au poignet.",
    },
    {
        "slug": "braided-bracelet", "name": "Bracelet Tressé Or", "price": "269",
        "image_url": "/assets/p-bracelet.jpg", "category_slug": "bracelets",
        "status": "available", "stock": 30,
        "description": "Manchette en or finement tissée. Substantielle, raffinée, à porter seule ou en superposition.",
    },
    {
        "slug": "tungsten-ring", "name": "Bague Tungstène Facettée Noire", "price": "179",
        "image_url": "/assets/p-ring-tungsten.jpg", "category_slug": "rings",
        "is_bestseller": True, "status": "available", "has_sizes": True,
        "description": "Bague en carbure de tungstène aux facettes géométriques. "
                       "Inrayable, lourde, profondément masculine.",
    },
    {
        "slug": "black-rings-set", "name": "Coffret 7 Bagues Noires", "price": "149",
        "image_url": "/assets/p-rings-black.jpg", "category_slug": "rings",
        "status": "available", "has_sizes": True,
        "description": "Sept bagues en acier noir aux finitions variées : polie, martelée, à chaîne, facettée. "
                       "Pour composer chaque jour.",
    },
    {
        "slug": "black-gold-rings", "name": "Coffret Bagues Noir & Or", "price": "169",
        "image_url": "/assets/p-rings-black-gold.jpg", "category_slug": "rings",
        "status": "coming_soon", "has_sizes": True,
        "description": "Cinq bagues mixant acier noir poli et accents or champagne. "
                       "La signature Maison du contraste.",
    },
    {
        "slug": "crown-bracelet", "name": "Bracelet Royal Couronne Or", "price": "189",
        "image_url": "/assets/p-bracelet-crown.jpg", "category_slug": "bracelets",
        "is_bestseller": True, "status": "available", "stock": 18,
        "description": "Perles d'acier doré texturées avec pièce centrale couronne sertie de zircons. "
                       "Cordon ajustable noir.",
    },
    {
        "slug": "tiger-bracelet", "name": "Bracelet Œil de Tigre", "price": "89",
        "image_url": "/assets/p-bracelet-tiger.jpg", "category_slug": "bracelets",
        "status": "available", "stock": 50,
        "description": "Perles d'œil de tigre véritable 14mm. La pierre du courage et de la protection, "
                       "montée sur élastique premium.",
    },
    {
        "slug": "tiger-trio-bracelet", "name": "Trio Bracelets Tigre & Onyx", "price": "129",
        "image_url": "/assets/p-bracelet-tiger-trio.jpg", "category_slug": "bracelets",
        "status": "available", "stock": 22,
        "description": "Trois bracelets superposés en œil de tigre, onyx noir et hématite. "
                       "La parure complète du gentleman moderne.",
    },
    {
        "slug": "onyx-stack-bracelet", "name": "Empilement Onyx & Lave", "price": "119",
        "image_url": "/assets/p-bracelet-onyx-stack.jpg", "category_slug": "bracelets",
        "status": "available", "stock": 28,
        "description": "Quatre bracelets en pierre de lave noire, onyx et hématite. Texture brute, élégance affirmée.",
    },
    {
        "slug": "earring-gold-shiny", "name": "Boucles d'Oreille Anneaux Or Poli", "price": "59",
        "image_url": "/assets/p-earring-gold-shiny.jpg", "category_slug": "earrings",
        "is_bestseller": True, "status": "available", "stock": 60,
        "description": "Petits anneaux huggie en acier plaqué or poli miroir. Discrets, hypoallergéniques, "
                       "à porter au quotidien.",
    },
    {
        "slug": "earring-gold-textured", "name": "Boucles d'Oreille Or Diamanté", "price": "69",
        "image_url": "/assets/p-earring-gold-textured.jpg", "category_slug": "earrings",
        "status": "available", "stock": 45,
        "description": "Anneaux huggie or aux trois bandes texturées effet diamant. "
                       "Reflets scintillants, signature affirmée.",
    },
    {
        "slug": "earring-black", "name": "Boucles d'Oreille Noires Diamantées", "price": "59",
        "image_url": "/assets/p-earring-black.jpg", "category_slug": "earrings",
        "status": "available", "stock": 40,
        "description": "Anneaux huggie en acier noir mat aux bandes pailletées. L'alternative bold pour homme moderne.",
    },

    # ----------------------------------------------------------------
    # STEPHIE BEAUTY — « Votre peau est votre identité »
    # Skincare & maquillage de qualité, pour révéler la beauté naturelle.
    # ----------------------------------------------------------------

    # --- Visage (teint & soin) ---
    {
        "slug": "silk-foundation", "name": "Fond de Teint Sérum Soie", "price": "2200",
        "image_url": _u(PHOTO["foundation_bottle"]), "category_slug": "face",
        "is_bestseller": True, "status": "available", "stock": 50,
        "description": "Hybride sérum-fond de teint léger, couvrance moyenne lumineuse, "
                       "enrichi en actifs soin. Pour un teint frais et hydraté toute la journée.",
    },
    {
        "slug": "matte-foundation", "name": "Fond de Teint Mat Velours", "price": "2400",
        "image_url": _u(PHOTO["foundation_alt"]), "category_slug": "face",
        "status": "available", "stock": 40,
        "description": "Fini mat poudré longue tenue. Couvrance modulable, idéal pour les "
                       "peaux mixtes à grasses. Sans transfert.",
    },
    {
        "slug": "stephie-concealer", "name": "Concealer Anti-Cernes Lumière", "price": "1200",
        "image_url": _u(PHOTO["cosmetics_close"]), "category_slug": "face",
        "is_bestseller": True, "status": "available", "stock": 70,
        "description": "Correcteur crémeux haute couvrance qui illumine le regard. "
                       "Texture confortable, ne marque pas les ridules.",
    },
    {
        "slug": "loose-powder", "name": "Poudre Libre Halo", "price": "1800",
        "image_url": _u(PHOTO["cosmetics_flat"]), "category_slug": "face",
        "status": "available", "stock": 35,
        "description": "Poudre libre ultra-fine pour fixer le maquillage avec un fini "
                       "soyeux et invisible. Texture buvard.",
    },
    {
        "slug": "pressed-powder", "name": "Poudre Compacte Translucide", "price": "1500",
        "image_url": _u(PHOTO["cosmetics_close"]), "category_slug": "face",
        "status": "available", "stock": 45,
        "description": "Poudre compacte pour matifier en quelques secondes. Format "
                       "voyage avec miroir intégré.",
    },
    {
        "slug": "face-primer", "name": "Primer Visage Lissant", "price": "1600",
        "image_url": _u(PHOTO["foundation_bottle"]), "category_slug": "face",
        "status": "available", "stock": 50,
        "description": "Base flouteuse aux extraits végétaux qui lisse les pores et "
                       "prolonge la tenue du maquillage jusqu'à 12h.",
    },
    {
        "slug": "setting-spray", "name": "Setting Spray Longue Tenue", "price": "1700",
        "image_url": _u(PHOTO["foundation_alt"]), "category_slug": "face",
        "is_bestseller": True, "status": "available", "stock": 60,
        "description": "Brume de fixation hydratante qui scelle le maquillage et "
                       "illumine le teint. Tenue jusqu'à 16h.",
    },
    {
        "slug": "highlighter", "name": "Highlighter Glow Doré", "price": "1800",
        "image_url": _u(PHOTO["palette_luxe"]), "category_slug": "face",
        "status": "available", "stock": 40,
        "description": "Palette lumière aux reflets champagne et or rose. Texture "
                       "beurrée pour un éclat naturel ou sculpté.",
    },
    {
        "slug": "milk-of-magnesia", "name": "Lait de Magnésie Matifiant", "price": "850",
        "image_url": _u(PHOTO["foundation_bottle"]), "category_slug": "face",
        "status": "available", "stock": 55,
        "description": "Astuce des pros : appliqué sous le fond de teint, il absorbe "
                       "l'excès de sébum et garde un teint mat toute la journée.",
    },
    {
        "slug": "makeup-remover", "name": "Démaquillant Doux Bi-Phase", "price": "1100",
        "image_url": _u(PHOTO["cosmetics_flat"]), "category_slug": "face",
        "status": "available", "stock": 50,
        "description": "Démaquillant bi-phase efficace même sur les maquillages "
                       "waterproof. Respecte le film hydrolipidique de la peau.",
    },

    # --- Yeux ---
    {
        "slug": "stephie-eyeshadow-palette", "name": "Palette Eyeshadow Stephie 12 Nuances", "price": "2800",
        "image_url": _u(PHOTO["eyeshadow_palette"]), "category_slug": "eyes",
        "is_bestseller": True, "status": "available", "stock": 35,
        "description": "Douze nuances ultra-pigmentées : neutres, bronze, cuivre et "
                       "smoky. Texture beurrée, fondante, inoubliable.",
    },
    {
        "slug": "contour-palette", "name": "Palette Contouring 4 Teintes", "price": "2500",
        "image_url": _u(PHOTO["palette_luxe"]), "category_slug": "eyes",
        "status": "available", "stock": 30,
        "description": "Quatre teintes pour sculpter, bronzer et illuminer le visage. "
                       "Texture poudre fine, modulable.",
    },
    {
        "slug": "volume-mascara", "name": "Mascara Volume Obsidienne", "price": "950",
        "image_url": _u(PHOTO["mascara"]), "category_slug": "eyes",
        "is_bestseller": True, "status": "available", "stock": 80,
        "description": "Mascara noir carbone qui allonge, volumise et définit de la "
                       "racine à la pointe sans faire de paquets.",
    },
    {
        "slug": "liquid-eyeliner", "name": "Eyeliner Liquide Précision", "price": "850",
        "image_url": _u(PHOTO["mascara_wand"]), "category_slug": "eyes",
        "status": "available", "stock": 65,
        "description": "Pointe ultra-fine en feutre, encre noir intense longue tenue. "
                       "Pour des traits parfaits du quotidien au glam.",
    },
    {
        "slug": "eye-pencil", "name": "Crayon Yeux Noir Velours", "price": "600",
        "image_url": _u(PHOTO["mascara_alt"]), "category_slug": "eyes",
        "status": "available", "stock": 75,
        "description": "Crayon kohl crémeux pour intensifier le regard. S'estompe "
                       "facilement pour un effet smoky.",
    },
    {
        "slug": "brow-pencil", "name": "Crayon à Sourcils Sculpteur", "price": "750",
        "image_url": _u(PHOTO["mascara_wand"]), "category_slug": "eyes",
        "is_bestseller": True, "status": "available", "stock": 70,
        "description": "Mine ultra-fine pour dessiner chaque poil. Goupillon intégré "
                       "pour discipliner et structurer les sourcils.",
    },
    {
        "slug": "eye-primer", "name": "Primer Yeux Longue Tenue", "price": "950",
        "image_url": _u(PHOTO["eyeshadow_close"]), "category_slug": "eyes",
        "status": "available", "stock": 50,
        "description": "Base paupières qui empêche les fards de migrer et ravive leur "
                       "pigmentation. Essentiel pour un maquillage qui dure.",
    },

    # --- Lèvres ---
    {
        "slug": "matte-lipstick", "name": "Rouge à Lèvres Velours Mat", "price": "950",
        "image_url": _u(PHOTO["lipsticks_red_gold"]), "category_slug": "lips",
        "is_bestseller": True, "status": "available", "stock": 90,
        "description": "Rouge à lèvres mat longue tenue, fini crémeux et léger. "
                       "Confortable, sans dessécher. Étui doré signature.",
    },
    {
        "slug": "lip-gloss", "name": "Lip Gloss Glow Repulpant", "price": "700",
        "image_url": _u(PHOTO["lipsticks_lineup"]), "category_slug": "lips",
        "status": "available", "stock": 80,
        "description": "Gloss brillant non collant aux micro-paillettes dorées. "
                       "Effet lèvres pulpeuses et lumineuses.",
    },
    {
        "slug": "lip-balm", "name": "Baume à Lèvres Hydratant Karité", "price": "450",
        "image_url": _u(PHOTO["lipstick_single"]), "category_slug": "lips",
        "status": "available", "stock": 100,
        "description": "Baume nourrissant au beurre de karité et vitamine E. Répare "
                       "les lèvres gercées en quelques heures.",
    },
    {
        "slug": "lip-pencil", "name": "Crayon Contour Lèvres", "price": "600",
        "image_url": _u(PHOTO["lipsticks_red_gold"]), "category_slug": "lips",
        "status": "available", "stock": 60,
        "description": "Crayon haute pigmentation pour dessiner et redessiner le "
                       "contour des lèvres. Tenue toute la journée.",
    },

    # --- Accessoires ---
    {
        "slug": "beauty-blender", "name": "Beauty Blender Premium Rose", "price": "600",
        "image_url": _u(PHOTO["brushes_makeup"]), "category_slug": "tools",
        "is_bestseller": True, "status": "available", "stock": 100,
        "description": "Éponge en mousse latex-free qui double de volume mouillée. "
                       "Pour un teint impeccable sans démarcation.",
    },
    {
        "slug": "gold-brush-set", "name": "Set 12 Pinceaux Pro Or", "price": "3500",
        "image_url": _u(PHOTO["brushes_set"]), "category_slug": "tools",
        "status": "available", "stock": 25,
        "description": "Douze pinceaux professionnels aux poils vegan ultra-doux et "
                       "manches dorés signature. Avec pochette de rangement.",
    },
    {
        "slug": "spoolies", "name": "Goupillons Sourcils & Cils (Lot de 5)", "price": "350",
        "image_url": _u(PHOTO["brushes_alt"]), "category_slug": "tools",
        "status": "available", "stock": 120,
        "description": "Cinq goupillons jetables pour discipliner les sourcils et "
                       "séparer les cils après le mascara.",
    },
    {
        "slug": "precision-epilator", "name": "Épilateur Précision Sourcils", "price": "1800",
        "image_url": _u(PHOTO["cosmetics_close"]), "category_slug": "tools",
        "status": "available", "stock": 35,
        "description": "Pince à épiler en acier inoxydable, biseau précis pour "
                       "sculpter les sourcils sans douleur.",
    },

    # --- Kits & Coffrets (gold background to pop) ---
    {
        "slug": "kit-glow-starter", "name": "Kit Glow Starter — Débutant", "price": "7500",
        "image_url": _u(PHOTO["cosmetics_flat"]), "category_slug": "kits",
        "is_bestseller": True, "status": "available", "stock": 20,
        "description": "Pour commencer en maquillage. Le kit contient : fond de teint, "
                       "poudre, lip gloss ou baume à lèvres, mascara, crayon à sourcils, "
                       "éponge beauty blender et démaquillant.",
    },
    {
        "slug": "kit-soft-glam", "name": "Kit Soft Glam — Intermédiaire", "price": "12500",
        "image_url": _u(PHOTO["palette_luxe"]), "category_slug": "kits",
        "is_bestseller": True, "status": "available", "stock": 15,
        "description": "Pour un maquillage naturel et élégant. Le kit contient : fond "
                       "de teint, correcteur, poudre, rouge à lèvres, mascara, eyeliner, "
                       "crayon à sourcils, beauty blender, petite palette eyeshadow, "
                       "primer visage et démaquillant.",
    },
    {
        "slug": "kit-queen-glam", "name": "Kit Queen Glam — Premium", "price": "22500",
        "image_url": _u(PHOTO["eyeshadow_palette"]), "category_slug": "kits",
        "is_bestseller": True, "status": "available", "stock": 10,
        "description": "Pour un maquillage complet et professionnel. Le kit contient : "
                       "fond de teint, correcteur, poudre, palette eyeshadow, palette "
                       "contouring, highlighter, rouge à lèvres + gloss, mascara, "
                       "eyeliner, crayon à sourcils, primer visage + yeux, setting spray, "
                       "set de pinceaux et démaquillant.",
    },
]


def seed(db) -> None:
    # 1. Categories — pass 1: top-level groups (parent=None) so they
    # get an id we can reference in pass 2 for the leaves.
    cat_by_slug: dict[str, Category] = {}
    for slug, name, section, display_order, parent_slug in CATEGORIES:
        existing = db.query(Category).filter_by(slug=slug).first()
        if existing:
            cat_by_slug[slug] = existing
            continue
        if parent_slug is not None:
            continue  # second pass
        cat = Category(slug=slug, name=name, section=section, display_order=display_order)
        db.add(cat)
        db.flush()
        cat_by_slug[slug] = cat
        print(f"  + group     '{slug}' ({section})")

    # Pass 2: leaf categories with their parent_id set
    for slug, name, section, display_order, parent_slug in CATEGORIES:
        if parent_slug is None:
            continue
        if slug in cat_by_slug:
            continue
        parent = cat_by_slug.get(parent_slug)
        if not parent:
            print(f"  ! parent '{parent_slug}' missing for '{slug}', skipped")
            continue
        cat = Category(
            slug=slug,
            name=name,
            section=section,
            display_order=display_order,
            parent_id=parent.id,
        )
        db.add(cat)
        db.flush()
        cat_by_slug[slug] = cat
        print(f"  + leaf      '{slug}' → {parent_slug} ({section})")

    # 2. Products
    for p in PRODUCTS:
        if db.query(Product).filter_by(slug=p["slug"]).first():
            continue
        category = cat_by_slug[p["category_slug"]]
        product = Product(
            slug=p["slug"],
            name=p["name"],
            description=p["description"],
            price=Decimal(p["price"]),
            image_url=p["image_url"],
            category_id=category.id,
            section=category.section,
            status=p.get("status", "available"),
            is_bestseller=p.get("is_bestseller", False),
            is_active=True,
            has_sizes=p.get("has_sizes", False),
            stock=p.get("stock", 0),
        )
        db.add(product)
        db.flush()

        if product.has_sizes:
            for label in DEFAULT_RING_SIZES:
                db.add(
                    ProductSize(
                        product_id=product.id,
                        size_label=label,
                        stock=10,
                    )
                )
        print(f"  + product '{p['slug']}'")

    db.commit()
    print("Catalog seed complete.")


if __name__ == "__main__":
    db = SessionLocal()
    try:
        print("Seeding catalog...")
        seed(db)
    finally:
        db.close()
