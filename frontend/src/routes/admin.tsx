import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { LayoutDashboard, Package, FolderTree, Receipt, LogOut, Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administration — Carat & Couleur" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLayout,
});

const nav = [
  { to: "/admin", label: "Tableau de bord", Icon: LayoutDashboard, exact: true },
  { to: "/admin/products", label: "Produits", Icon: Package, exact: false },
  { to: "/admin/categories", label: "Catégories", Icon: FolderTree, exact: false },
  { to: "/admin/orders", label: "Commandes", Icon: Receipt, exact: false },
];

function AdminLayout() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (user.role !== "admin" && user.role !== "manager") {
      navigate({ to: "/" });
    }
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  const isDashboard = location.pathname === "/admin" || location.pathname === "/admin/";

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 lg:grid-cols-[240px_1fr]">
      <aside className="h-fit border border-border bg-card p-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Administration</p>
          <p className="mt-1 font-display text-xl">Carat &amp; Couleur</p>
        </div>
        <div className="gold-divider my-6" />
        <nav className="flex flex-col gap-1">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeProps={{ className: "bg-gold text-primary-foreground" }}
              activeOptions={{ exact: n.exact }}
              className="flex items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-card-foreground/5 hover:text-gold"
            >
              <n.Icon className="h-4 w-4" />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-8 border-t border-border pt-6">
          <p className="text-xs text-muted-foreground">Connecté en tant que</p>
          <p className="mt-1 text-sm font-medium">{user.username}</p>
          <p className="text-[11px] uppercase tracking-[0.2em] text-gold">{user.role}</p>
          <button
            onClick={logout}
            className="mt-4 inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-gold"
          >
            <LogOut className="h-3.5 w-3.5" /> Déconnexion
          </button>
        </div>
      </aside>

      <section>
        {isDashboard ? <AdminDashboard /> : <Outlet />}
      </section>
    </div>
  );
}

function AdminDashboard() {
  return (
    <div>
      <h1 className="font-display text-4xl">Tableau de bord</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Bienvenue dans l'espace d'administration Carat & Couleur. Gérez votre catalogue, vos catégories et vos commandes.
      </p>
      <div className="gold-divider mt-8" />

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Link to="/admin/products" className="group block border border-border bg-card p-8 transition-colors hover:border-gold">
          <Package className="h-8 w-8 text-gold" />
          <h2 className="mt-4 font-display text-2xl">Produits</h2>
          <p className="mt-2 text-sm text-muted-foreground">Créer, modifier, marquer comme disponible ou « à venir ».</p>
          <span className="mt-4 inline-block text-xs uppercase tracking-[0.2em] text-gold group-hover:underline">
            Gérer →
          </span>
        </Link>

        <Link to="/admin/categories" className="group block border border-border bg-card p-8 transition-colors hover:border-gold">
          <FolderTree className="h-8 w-8 text-gold" />
          <h2 className="mt-4 font-display text-2xl">Catégories</h2>
          <p className="mt-2 text-sm text-muted-foreground">Organisez la boutique en sections : bagues, bracelets, beauté…</p>
          <span className="mt-4 inline-block text-xs uppercase tracking-[0.2em] text-gold group-hover:underline">
            Gérer →
          </span>
        </Link>

        <Link to="/admin/orders" className="group block border border-border bg-card p-8 transition-colors hover:border-gold">
          <Receipt className="h-8 w-8 text-gold" />
          <h2 className="mt-4 font-display text-2xl">Commandes</h2>
          <p className="mt-2 text-sm text-muted-foreground">Suivez les paiements MonCash et l'expédition des commandes.</p>
          <span className="mt-4 inline-block text-xs uppercase tracking-[0.2em] text-gold group-hover:underline">
            Voir →
          </span>
        </Link>
      </div>
    </div>
  );
}
