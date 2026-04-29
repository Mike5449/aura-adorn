import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ImageUp, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { categoryApi, mediaApi, productApi, resolveImageUrl } from "@/lib/api";
import type { ApiCategory, ApiProduct, ApiProductSize, ProductStatus } from "@/lib/api-types";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/products/$id")({
  component: AdminProductForm,
});

interface SizeRow {
  size_label: string;
  stock: number;
  is_active: boolean;
}

interface FormState {
  slug: string;
  name: string;
  description: string;
  price: string;
  purchase_price: string;
  image_url: string;
  category_id: number | "";
  status: ProductStatus;
  is_bestseller: boolean;
  is_active: boolean;
  has_sizes: boolean;
  stock: number;
  sizes: SizeRow[];
}

const empty: FormState = {
  slug: "",
  name: "",
  description: "",
  price: "0",
  purchase_price: "0",
  image_url: "",
  category_id: "",
  status: "available",
  is_bestseller: false,
  is_active: true,
  has_sizes: false,
  stock: 0,
  sizes: [],
};

function fromApi(p: ApiProduct): FormState {
  return {
    slug: p.slug,
    name: p.name,
    description: p.description,
    price: String(p.price),
    purchase_price: String(p.purchase_price ?? "0"),
    image_url: p.image_url,
    category_id: p.category_id,
    status: p.status,
    is_bestseller: p.is_bestseller,
    is_active: p.is_active,
    has_sizes: p.has_sizes,
    stock: p.stock,
    sizes: p.sizes.map((s: ApiProductSize) => ({
      size_label: s.size_label,
      stock: s.stock,
      is_active: s.is_active,
    })),
  };
}

function AdminProductForm() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user, isSuperAdmin } = useAuth();
  const isNew = id === "new";

  const [form, setForm] = useState<FormState>(empty);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // For non-super admins, restrict the category dropdown to their
  // explicitly-allowed leaf categories.
  const allowedCategoryIds = useMemo(() => {
    if (isSuperAdmin || !user) return null; // null = unrestricted
    return new Set((user.allowed_categories ?? []).map((c) => c.id));
  }, [isSuperAdmin, user]);

  const handleFile = async (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Le fichier doit être une image (JPEG, PNG, WebP, GIF).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image trop lourde — 5 Mo maximum.");
      return;
    }
    setUploading(true);
    try {
      const { url } = await mediaApi.upload(file);
      setForm((f) => ({ ...f, image_url: url }));
      toast.success("Image téléversée");
    } catch (e: any) {
      toast.error(e?.message ?? "Échec de l'upload");
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const cats = await categoryApi.list();
        setCategories(cats);
        if (!isNew) {
          const p = await productApi.get(Number(id));
          setForm(fromApi(p));
        } else {
          setForm((f) => ({ ...f, category_id: cats[0]?.id ?? "" }));
        }
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur de chargement");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isNew]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const addSize = () =>
    setForm((f) => ({ ...f, sizes: [...f.sizes, { size_label: "", stock: 0, is_active: true }] }));

  const updateSize = (i: number, k: keyof SizeRow, v: any) =>
    setForm((f) => ({
      ...f,
      sizes: f.sizes.map((s, idx) => (idx === i ? { ...s, [k]: v } : s)),
    }));

  const removeSize = (i: number) =>
    setForm((f) => ({ ...f, sizes: f.sizes.filter((_, idx) => idx !== i) }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.category_id) {
      toast.error("Sélectionnez une catégorie");
      return;
    }
    setSaving(true);
    const payload = {
      slug: form.slug.trim().toLowerCase(),
      name: form.name.trim(),
      description: form.description.trim(),
      price: form.price,
      purchase_price: form.purchase_price || "0",
      image_url: form.image_url.trim(),
      category_id: Number(form.category_id),
      status: form.status,
      is_bestseller: form.is_bestseller,
      is_active: form.is_active,
      has_sizes: form.has_sizes,
      stock: Number(form.stock) || 0,
      sizes: form.has_sizes
        ? form.sizes
            .filter((s) => s.size_label.trim())
            .map((s) => ({
              size_label: s.size_label.trim(),
              stock: Number(s.stock) || 0,
              is_active: s.is_active,
            }))
        : [],
    };
    try {
      if (isNew) {
        await productApi.create(payload);
        toast.success("Produit créé");
      } else {
        await productApi.update(Number(id), payload);
        toast.success("Produit mis à jour");
      }
      navigate({ to: "/admin/products" });
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur d'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const isRing = useMemo(() => {
    const cat = categories.find((c) => c.id === Number(form.category_id));
    return cat?.slug === "rings";
  }, [categories, form.category_id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link to="/admin/products" className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-gold">
            <ArrowLeft className="h-3.5 w-3.5" /> Retour à la liste
          </Link>
          <h1 className="mt-2 font-display text-3xl">
            {isNew ? "Nouveau produit" : "Modifier le produit"}
          </h1>
        </div>
        <Button variant="luxe" type="submit" disabled={saving}>
          {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enregistrement…</> : "Enregistrer"}
        </Button>
      </div>

      <div className="gold-divider my-6" />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Identité">
            <Field label="Nom *">
              <input required value={form.name} onChange={(e) => set("name", e.target.value)} className={input} />
            </Field>
            <Field label="Slug (URL) *">
              <input
                required
                value={form.slug}
                onChange={(e) => set("slug", e.target.value)}
                placeholder="bague-onyx-noir"
                className={input}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Minuscules, chiffres et tirets uniquement. C'est l'URL publique du produit.
              </p>
            </Field>
            <Field label="Description *">
              <textarea
                required
                rows={5}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                className={`${input} resize-none`}
              />
            </Field>
            <Field label="Image du produit *">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  handleFile(e.target.files?.[0]);
                  e.target.value = ""; // allow re-selecting the same file
                }}
              />

              <div
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleFile(e.dataTransfer.files?.[0]);
                }}
                className="flex items-start gap-4 border border-dashed border-border bg-background/40 p-3"
              >
                {form.image_url ? (
                  <img
                    src={resolveImageUrl(form.image_url)}
                    alt="Aperçu"
                    className="h-28 w-28 shrink-0 border border-border object-cover"
                  />
                ) : (
                  <div className="flex h-28 w-28 shrink-0 items-center justify-center border border-border text-muted-foreground">
                    <ImageUp className="h-6 w-6" />
                  </div>
                )}

                <div className="flex flex-1 flex-col gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outlineGold"
                      size="sm"
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploading ? (
                        <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Téléversement…</>
                      ) : (
                        <><Upload className="mr-2 h-3.5 w-3.5" /> Choisir un fichier</>
                      )}
                    </Button>
                    {form.image_url && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => set("image_url", "")}
                      >
                        Retirer
                      </Button>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Glissez-déposez une image ou choisissez un fichier depuis votre
                    appareil. Sur mobile, votre OS proposera la galerie ou la caméra.
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  Ou collez une URL d'internet
                </span>
                <input
                  required
                  type="text"
                  value={form.image_url}
                  onChange={(e) => set("image_url", e.target.value)}
                  placeholder="https://images.example.com/photo.jpg ou /media/…"
                  className={`${input} mt-1`}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  URL https://… (Unsplash, votre CDN…) ou chemin local généré
                  automatiquement après un téléversement.
                </p>
              </div>
            </Field>
          </Card>

          {form.has_sizes && (
            <Card title={isRing ? "Tailles (numéros de bague)" : "Tailles"}>
              <p className="text-sm text-muted-foreground">
                {isRing
                  ? "Ajoutez chaque numéro de bague disponible et son stock — le client choisira le numéro qui correspond à son doigt."
                  : "Ajoutez chaque taille disponible et son stock."}
              </p>
              <div className="mt-4 space-y-2">
                {form.sizes.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      placeholder="Numéro / Taille"
                      value={s.size_label}
                      onChange={(e) => updateSize(i, "size_label", e.target.value)}
                      className={`${input} w-40`}
                    />
                    <input
                      type="number"
                      min={0}
                      placeholder="Stock"
                      value={s.stock}
                      onChange={(e) => updateSize(i, "stock", Number(e.target.value))}
                      className={`${input} w-32`}
                    />
                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={s.is_active}
                        onChange={(e) => updateSize(i, "is_active", e.target.checked)}
                      />
                      Actif
                    </label>
                    <button
                      type="button"
                      onClick={() => removeSize(i)}
                      className="ml-auto text-muted-foreground hover:text-destructive"
                      aria-label="Supprimer cette taille"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <Button type="button" variant="outlineGold" size="sm" onClick={addSize}>
                  <Plus className="mr-2 h-3.5 w-3.5" /> Ajouter une taille
                </Button>
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card title="Catégorie & prix">
            <Field label="Catégorie *">
              <select
                required
                value={form.category_id}
                onChange={(e) => set("category_id", Number(e.target.value))}
                className={input}
              >
                <option value="">— Choisir —</option>
                {[...categories]
                  // For non-super admins, only their allowed leaf categories
                  .filter((c) => allowedCategoryIds === null || allowedCategoryIds.has(c.id))
                  .sort((a, b) => {
                    if (a.section !== b.section) return a.section.localeCompare(b.section);
                    const aRoot = a.parent_id ?? a.id;
                    const bRoot = b.parent_id ?? b.id;
                    if (aRoot !== bRoot) return aRoot - bRoot;
                    return (a.parent_id === null ? -1 : 0) - (b.parent_id === null ? -1 : 0);
                  })
                  .map((c) => {
                    const parent = categories.find((p) => p.id === c.parent_id);
                    const label = parent
                      ? `   ↳ ${c.name}` // leaf, indented
                      : `${c.name}`;     // group
                    return (
                      <option key={c.id} value={c.id} disabled={c.parent_id === null && categories.some(x => x.parent_id === c.id)}>
                        [{c.section}] {label}{parent ? ` (${parent.name})` : " — groupe"}
                      </option>
                    );
                  })}
              </select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {allowedCategoryIds === null
                  ? "Choisissez une catégorie feuille (Bagues, Visage…)."
                  : `Vous voyez uniquement les ${allowedCategoryIds.size} catégorie(s) que le super_admin vous a attribuée(s).`}
              </p>
            </Field>
            <Field label="Prix de vente (USD $) *">
              <input
                type="number"
                min={0}
                step="0.01"
                required
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
                className={input}
              />
            </Field>
            <Field label="Prix d'achat (USD $)">
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.purchase_price}
                onChange={(e) => set("purchase_price", e.target.value)}
                placeholder="Coût du produit"
                className={input}
              />
              {Number(form.purchase_price) > 0 && Number(form.price) > 0 && (() => {
                const margin = Number(form.price) - Number(form.purchase_price);
                const pct = (margin / Number(form.price)) * 100;
                return (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Marge : <strong className={margin > 0 ? "text-emerald-400" : "text-destructive"}>
                      ${margin.toFixed(2)}
                    </strong> ({pct.toFixed(1)} %)
                  </p>
                );
              })()}
            </Field>
          </Card>

          <Card title="Disponibilité">
            <Field label="Statut">
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value as ProductStatus)}
                className={input}
              >
                <option value="available">Disponible</option>
                <option value="coming_soon">À venir (bientôt disponible)</option>
              </select>
            </Field>

            <Toggle
              label="Best-seller"
              checked={form.is_bestseller}
              onChange={(v) => set("is_bestseller", v)}
            />
            <Toggle
              label="Visible sur la boutique"
              checked={form.is_active}
              onChange={(v) => set("is_active", v)}
            />
            <Toggle
              label="Le produit a des tailles (bagues, etc.)"
              checked={form.has_sizes}
              onChange={(v) => set("has_sizes", v)}
            />

            {!form.has_sizes && (
              <Field label="Stock total">
                <input
                  type="number"
                  min={0}
                  value={form.stock}
                  onChange={(e) => set("stock", Number(e.target.value))}
                  className={input}
                />
              </Field>
            )}
          </Card>
        </div>
      </div>
    </form>
  );
}

const input =
  "w-full border border-border bg-background px-3 py-2 text-sm focus:border-gold focus:outline-none";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border bg-card p-6">
      <h3 className="text-xs uppercase tracking-[0.3em] text-gold">{title}</h3>
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1 text-sm">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-gold"
      />
    </label>
  );
}
