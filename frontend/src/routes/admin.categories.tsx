import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { categoryApi } from "@/lib/api";
import type { ApiCategory, Section } from "@/lib/api-types";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/categories")({
  component: AdminCategories,
});

interface DraftCategory {
  id?: number;
  slug: string;
  name: string;
  section: Section;
  display_order: number;
}

const blank: DraftCategory = { slug: "", name: "", section: "jewelry", display_order: 0 };

function AdminCategories() {
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<DraftCategory | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      setCategories(await categoryApi.list());
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const payload = {
        slug: editing.slug.trim().toLowerCase(),
        name: editing.name.trim(),
        section: editing.section,
        display_order: Number(editing.display_order) || 0,
      };
      if (editing.id) {
        await categoryApi.update(editing.id, payload);
        toast.success("Catégorie mise à jour");
      } else {
        await categoryApi.create(payload);
        toast.success("Catégorie créée");
      }
      setEditing(null);
      reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur d'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: ApiCategory) => {
    if (!confirm(`Supprimer la catégorie « ${c.name} » ? (Elle ne doit plus contenir de produits)`)) return;
    try {
      await categoryApi.remove(c.id);
      toast.success("Catégorie supprimée");
      reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Suppression impossible");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Catégories</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organisez votre boutique en sections (Bijoux / Beauté) et catégories.
          </p>
        </div>
        <Button variant="luxe" onClick={() => setEditing({ ...blank })}>
          <Plus className="mr-2 h-4 w-4" /> Nouvelle catégorie
        </Button>
      </div>

      <div className="gold-divider my-6" />

      {editing && (
        <div className="mb-6 border border-gold bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl">
              {editing.id ? "Modifier" : "Nouvelle catégorie"}
            </h2>
            <button
              onClick={() => setEditing(null)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Annuler"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Nom *">
              <input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                className={input}
              />
            </Field>
            <Field label="Slug *">
              <input
                value={editing.slug}
                onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                placeholder="rings"
                className={input}
              />
            </Field>
            <Field label="Section *">
              <select
                value={editing.section}
                onChange={(e) => setEditing({ ...editing, section: e.target.value as Section })}
                className={input}
              >
                <option value="jewelry">Bijoux</option>
                <option value="beauty">Beauté</option>
              </select>
            </Field>
            <Field label="Ordre d'affichage">
              <input
                type="number"
                value={editing.display_order}
                onChange={(e) => setEditing({ ...editing, display_order: Number(e.target.value) })}
                className={input}
              />
            </Field>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button type="button" variant="outlineGold" onClick={() => setEditing(null)}>
              Annuler
            </Button>
            <Button type="button" variant="luxe" disabled={saving} onClick={save}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enregistrement…</> : <><Save className="mr-2 h-4 w-4" /> Enregistrer</>}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
        </div>
      ) : (
        <div className="overflow-hidden border border-border">
          <table className="w-full text-sm">
            <thead className="bg-card text-left text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <tr>
                <th className="p-3">Nom</th>
                <th className="p-3">Slug</th>
                <th className="p-3">Section</th>
                <th className="p-3">Ordre</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {categories.map((c) => (
                <tr key={c.id} className="hover:bg-card/40">
                  <td className="p-3 font-medium">{c.name}</td>
                  <td className="p-3 text-muted-foreground">/{c.slug}</td>
                  <td className="p-3">
                    <span className="rounded border border-gold/40 px-2 py-0.5 text-[11px] uppercase tracking-widest text-gold">
                      {c.section}
                    </span>
                  </td>
                  <td className="p-3">{c.display_order}</td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditing({
                          id: c.id,
                          slug: c.slug,
                          name: c.name,
                          section: c.section,
                          display_order: c.display_order,
                        })}
                        className="inline-flex h-8 w-8 items-center justify-center border border-border text-muted-foreground hover:border-gold hover:text-gold"
                        title="Modifier"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => remove(c)}
                        className="inline-flex h-8 w-8 items-center justify-center border border-border text-muted-foreground hover:border-destructive hover:text-destructive"
                        title="Supprimer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const input =
  "w-full border border-border bg-background px-3 py-2 text-sm focus:border-gold focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
