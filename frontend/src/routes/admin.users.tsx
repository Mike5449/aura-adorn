import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Crown, Loader2, Pencil, Save, Shield, Trash2, X, UserPlus, Power } from "lucide-react";
import { categoryApi, userApi } from "@/lib/api";
import type { ApiCategory, ApiUser } from "@/lib/api-types";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsers,
});

interface DraftAdmin {
  id?: number;
  username: string;
  email: string;
  password: string;
  role: "admin" | "super_admin";
  allowed_category_ids: number[];
  commission_pct: number;
  is_active: boolean;
}

const blank: DraftAdmin = {
  username: "",
  email: "",
  password: "",
  role: "admin",
  allowed_category_ids: [],
  commission_pct: 0,
  is_active: true,
};

function AdminUsers() {
  const { isSuperAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [admins, setAdmins] = useState<ApiUser[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<DraftAdmin | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !isSuperAdmin) {
      toast.error("Accès réservé au super_admin");
      navigate({ to: "/admin" });
    }
  }, [authLoading, isSuperAdmin, navigate]);

  const reload = async () => {
    setLoading(true);
    try {
      const [a, c] = await Promise.all([userApi.listAdmins(), categoryApi.list()]);
      setAdmins(a);
      setCategories(c);
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) reload();
  }, [isSuperAdmin]);

  // A category is "assignable" if products can be attached directly to it:
  // either a leaf (parent_id != null) OR a top-level group with no children
  // (e.g. Parfums Homme, Maillot Homme, Bijoux Femme — they hold products
  // directly until you create sub-categories).
  const assignableCategories = useMemo(() => {
    const hasChild = (id: number) => categories.some((c) => c.parent_id === id);
    return categories
      .filter((c) => c.parent_id !== null || !hasChild(c.id))
      .sort((a, b) =>
        a.section.localeCompare(b.section) ||
        ((a.parent_id ?? a.id) - (b.parent_id ?? b.id)) ||
        ((a.parent_id === null ? -1 : 0) - (b.parent_id === null ? -1 : 0)) ||
        a.display_order - b.display_order,
      );
  }, [categories]);

  const submit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      if (editing.id) {
        // Update both allowed_categories AND commission in sequence —
        // either is independent server-side; we just call both.
        await userApi.updateAllowedCategories(editing.id, editing.allowed_category_ids);
        await userApi.setCommission(editing.id, editing.commission_pct);
        toast.success("Admin mis à jour");
      } else {
        if (!editing.username || !editing.email || !editing.password) {
          toast.error("Tous les champs sont requis");
          setSaving(false);
          return;
        }
        await userApi.createAdmin({
          username: editing.username.trim(),
          email: editing.email.trim(),
          password: editing.password,
          role: editing.role,
          // super_admin n'a pas de scope — on envoie une liste vide
          allowed_category_ids: editing.role === "super_admin" ? [] : editing.allowed_category_ids,
          commission_pct: editing.commission_pct,
          is_active: editing.is_active,
        });
        toast.success(editing.role === "super_admin" ? "Super-admin créé" : "Admin créé");
      }
      setEditing(null);
      reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (u: ApiUser) => {
    try {
      await userApi.setStatus(u.id, !u.is_active);
      toast.success(u.is_active ? "Admin désactivé" : "Admin réactivé");
      reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    }
  };

  const removeAdmin = async (u: ApiUser) => {
    if (!confirm(`Supprimer définitivement l'admin « ${u.username} » ?`)) return;
    try {
      await userApi.remove(u.id);
      toast.success("Admin supprimé");
      reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Suppression impossible");
    }
  };

  const groupOf = (catId: number) => {
    const c = categories.find((x) => x.id === catId);
    if (!c) return "?";
    if (c.parent_id === null) return c.name;
    const p = categories.find((x) => x.id === c.parent_id);
    return p ? p.name : "?";
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Utilisateurs / Admins</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Créez des admins scopés ou d'autres super-admins. Les super-admins
            ont accès à tout, les admins sont restreints à certaines catégories.
          </p>
        </div>
        <Button variant="luxe" onClick={() => setEditing({ ...blank })}>
          <UserPlus className="mr-2 h-4 w-4" /> Nouvel utilisateur
        </Button>
      </div>

      <div className="gold-divider my-6" />

      {editing && (
        <div className="mb-6 border border-gold bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl">
              {editing.id
                ? `Modifier · ${editing.username}`
                : (editing.role === "super_admin" ? "Nouveau super-admin" : "Nouvel admin")}
            </h2>
            <button
              onClick={() => setEditing(null)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Annuler"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {!editing.id && (
            <>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Identifiant *">
                  <input
                    value={editing.username}
                    onChange={(e) => setEditing({ ...editing, username: e.target.value })}
                    placeholder="ex. emma"
                    className={input}
                  />
                </Field>
                <Field label="Email *">
                  <input
                    type="email"
                    value={editing.email}
                    onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                    placeholder="emma@boteakelegans.com"
                    className={input}
                  />
                </Field>
                <Field label="Mot de passe *">
                  <input
                    type="password"
                    value={editing.password}
                    onChange={(e) => setEditing({ ...editing, password: e.target.value })}
                    placeholder="8+ caractères : maj, min, chiffre, spécial"
                    className={input}
                  />
                </Field>
                <label className="flex items-end gap-2 pb-2">
                  <input
                    type="checkbox"
                    checked={editing.is_active}
                    onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                    className="h-4 w-4 accent-gold"
                  />
                  <span className="text-sm">Compte actif dès la création</span>
                </label>
              </div>

              <h3 className="mt-6 text-xs uppercase tracking-[0.3em] text-gold">Type de compte</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <RoleOption
                  active={editing.role === "admin"}
                  onClick={() => setEditing({ ...editing, role: "admin" })}
                  Icon={Shield}
                  title="Admin scopé"
                  desc="Accès limité aux catégories que vous lui attribuez ci-dessous. Idéal pour déléguer une partie du catalogue."
                />
                <RoleOption
                  active={editing.role === "super_admin"}
                  onClick={() => setEditing({ ...editing, role: "super_admin" })}
                  Icon={Crown}
                  title="Super-admin"
                  desc="Accès complet à la plateforme — produits, catégories, paramètres, autres admins. Aucune restriction."
                />
              </div>
            </>
          )}

          {/* Commission — applies to admin and super_admin */}
          <h3 className="mt-6 text-xs uppercase tracking-[0.3em] text-gold">
            Commission de la plateforme
          </h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Pourcentage prélevé par la boutique (super_admin) sur chaque commande payée
            contenant un produit appartenant à cet admin. 0 % = pas de commission.
          </p>
          <div className="mt-2 flex items-center gap-3">
            <input
              type="number"
              min={0}
              max={100}
              step="0.5"
              value={editing.commission_pct}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  commission_pct: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                })
              }
              className="w-32 border border-border bg-background px-3 py-2 text-lg focus:border-gold focus:outline-none"
            />
            <span className="font-display text-lg text-gold">%</span>
          </div>

          {editing.role === "super_admin" && !editing.id ? (
            <p className="mt-6 border border-gold/30 bg-gold/5 p-4 text-xs text-muted-foreground">
              Un super-admin n'a pas de catégories restreintes — il a accès à
              tout. Aucune sélection nécessaire ci-dessous.
            </p>
          ) : (
            <>
              <h3 className="mt-6 text-xs uppercase tracking-[0.3em] text-gold">
                Catégories autorisées (où il pourra ajouter des produits)
              </h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Cochez les catégories feuilles. L'admin ne pourra créer / modifier des produits que dans ces catégories.
          </p>
          <div className="mt-3 max-h-72 overflow-y-auto border border-border bg-background/40 p-3">
            {assignableCategories.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucune catégorie disponible.</p>
            ) : (
              <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {assignableCategories.map((c) => {
                  const checked = editing.allowed_category_ids.includes(c.id);
                  const isLeaf = c.parent_id !== null;
                  const parent = isLeaf ? groupOf(c.id) : null;
                  return (
                    <label key={c.id} className="flex cursor-pointer items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            allowed_category_ids: e.target.checked
                              ? [...editing.allowed_category_ids, c.id]
                              : editing.allowed_category_ids.filter((id) => id !== c.id),
                          })
                        }
                        className="mt-0.5 h-4 w-4 accent-gold"
                      />
                      <span className="leading-tight">
                        <span className="text-[10px] uppercase tracking-widest text-gold">
                          {c.section}
                          {parent && <> · {parent}</>}
                        </span>
                        <br />
                        <span>{c.name}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
            </>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <Button type="button" variant="outlineGold" onClick={() => setEditing(null)}>
              Annuler
            </Button>
            <Button type="button" variant="luxe" disabled={saving} onClick={submit}>
              {saving
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enregistrement…</>
                : <><Save className="mr-2 h-4 w-4" /> {editing.id ? "Sauvegarder catégories" : (editing.role === "super_admin" ? "Créer le super-admin" : "Créer l'admin")}</>}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
        </div>
      ) : admins.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">Aucun admin pour l'instant.</p>
      ) : (
        <div className="overflow-hidden border border-border">
          <table className="w-full text-sm">
            <thead className="bg-card text-left text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <tr>
                <th className="p-3">Admin</th>
                <th className="p-3">Email</th>
                <th className="p-3">Catégories autorisées</th>
                <th className="p-3">Commission</th>
                <th className="p-3">Statut</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {admins.map((u) => (
                <tr key={u.id} className="hover:bg-card/40">
                  <td className="p-3 font-medium">
                    <div className="flex items-center gap-2">
                      {u.role === "super_admin" ? (
                        <span
                          title="Super-admin — accès complet"
                          className="inline-flex items-center gap-1 border border-gold bg-gold/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-gold"
                        >
                          <Crown className="h-3 w-3" /> Super
                        </span>
                      ) : (
                        <span
                          title="Admin — scopé"
                          className="inline-flex items-center gap-1 border border-border px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground"
                        >
                          <Shield className="h-3 w-3" /> Admin
                        </span>
                      )}
                      <span>{u.username}</span>
                    </div>
                  </td>
                  <td className="p-3 text-muted-foreground">{u.email}</td>
                  <td className="p-3">
                    {u.role === "super_admin" ? (
                      <span className="text-xs text-gold italic">
                        accès complet (toutes catégories)
                      </span>
                    ) : u.allowed_categories.length === 0 ? (
                      <span className="text-xs text-muted-foreground italic">
                        aucune (l'admin ne peut rien créer)
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {u.allowed_categories.map((c) => (
                          <span
                            key={c.id}
                            className="rounded border border-gold/40 px-2 py-0.5 text-[11px] uppercase tracking-widest text-gold"
                          >
                            {c.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    {Number(u.commission_pct ?? 0) > 0 ? (
                      <span className="font-display text-base text-gold">
                        {Number(u.commission_pct).toLocaleString("fr-HT", { maximumFractionDigits: 2 })} %
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">aucune</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className={`rounded border px-2 py-0.5 text-[11px] uppercase tracking-widest ${u.is_active ? "border-emerald-500/40 text-emerald-400" : "border-destructive/40 text-destructive"}`}>
                      {u.is_active ? "Actif" : "Désactivé"}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-2">
                      {u.role !== "super_admin" && (
                        <button
                          onClick={() =>
                            setEditing({
                              id: u.id,
                              username: u.username,
                              email: u.email,
                              password: "",
                              role: u.role as "admin" | "super_admin",
                              allowed_category_ids: u.allowed_categories.map((c) => c.id),
                              commission_pct: Number(u.commission_pct ?? 0),
                              is_active: u.is_active,
                            })
                          }
                          className="inline-flex h-8 w-8 items-center justify-center border border-border text-muted-foreground hover:border-gold hover:text-gold"
                          title="Modifier les catégories autorisées"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => toggleStatus(u)}
                        className="inline-flex h-8 w-8 items-center justify-center border border-border text-muted-foreground hover:border-gold hover:text-gold"
                        title={u.is_active ? "Désactiver" : "Réactiver"}
                      >
                        <Power className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => removeAdmin(u)}
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

function RoleOption({
  active,
  onClick,
  Icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  Icon: typeof Crown;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-3 border p-4 text-left transition-colors ${
        active
          ? "border-gold bg-gold/10"
          : "border-border hover:border-gold/60 hover:bg-card"
      }`}
    >
      <Icon className={`h-5 w-5 shrink-0 ${active ? "text-gold" : "text-muted-foreground"}`} />
      <div>
        <p className={`text-sm font-medium ${active ? "text-gold" : ""}`}>{title}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{desc}</p>
      </div>
    </button>
  );
}
