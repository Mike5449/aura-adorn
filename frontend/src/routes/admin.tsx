import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { LayoutDashboard, Package, FolderTree, Receipt, LogOut, Loader2, Users, Boxes, Settings as SettingsIcon, UserCog } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administration — Beauté & Élégance" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLayout,
});

interface NavItem {
  to: string;
  label: string;
  Icon: typeof LayoutDashboard;
  exact: boolean;
  superOnly?: boolean;
}

const NAV: NavItem[] = [
  { to: "/admin",            label: "Tableau de bord", Icon: LayoutDashboard, exact: true  },
  { to: "/admin/products",   label: "Produits",        Icon: Package,         exact: false },
  { to: "/admin/orders",     label: "Commandes",       Icon: Receipt,         exact: false },
  { to: "/admin/stocks",     label: "Stocks",          Icon: Boxes,           exact: false },
  { to: "/admin/categories", label: "Catégories",      Icon: FolderTree,      exact: false, superOnly: true },
  { to: "/admin/users",      label: "Utilisateurs",    Icon: Users,           exact: false, superOnly: true },
  { to: "/admin/settings",   label: "Paramètres",      Icon: SettingsIcon,    exact: false, superOnly: true },
  { to: "/admin/profile",    label: "Mon profil",      Icon: UserCog,         exact: false },
];

function AdminLayout() {
  const { user, loading, logout, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (!["super_admin", "admin", "manager"].includes(user.role)) {
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
  const visibleNav = NAV.filter((n) => !n.superOnly || isSuperAdmin);

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 lg:grid-cols-[240px_1fr]">
      <aside className="h-fit border border-border bg-card p-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            {isSuperAdmin ? "Super Admin" : "Administration"}
          </p>
          <p className="mt-1 font-display text-xl">Beauté &amp; Élégance</p>
        </div>
        <div className="gold-divider my-6" />
        <nav className="flex flex-col gap-1">
          {visibleNav.map((n) => (
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
  const { isSuperAdmin, user } = useAuth();
  return (
    <div>
      <h1 className="font-display text-4xl">Tableau de bord</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {isSuperAdmin
          ? "Bienvenue Super Admin. Vous gérez toute la plateforme."
          : `Bienvenue ${user?.username}. Gérez vos produits et suivez vos commandes.`}
      </p>
      <div className="gold-divider mt-8" />

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Link to="/admin/products" className="group block border border-border bg-card p-8 transition-colors hover:border-gold">
          <Package className="h-8 w-8 text-gold" />
          <h2 className="mt-4 font-display text-2xl">Produits</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {isSuperAdmin
              ? "Tous les produits du catalogue."
              : "Vos produits — créez, modifiez, marquez disponibles ou à venir."}
          </p>
          <span className="mt-4 inline-block text-xs uppercase tracking-[0.2em] text-gold group-hover:underline">
            Gérer →
          </span>
        </Link>

        <Link to="/admin/orders" className="group block border border-border bg-card p-8 transition-colors hover:border-gold">
          <Receipt className="h-8 w-8 text-gold" />
          <h2 className="mt-4 font-display text-2xl">Commandes</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {isSuperAdmin
              ? "Toutes les commandes de la plateforme."
              : "Vos commandes — celles qui contiennent vos produits."}
          </p>
          <span className="mt-4 inline-block text-xs uppercase tracking-[0.2em] text-gold group-hover:underline">
            Voir →
          </span>
        </Link>

        <Link to="/admin/stocks" className="group block border border-border bg-card p-8 transition-colors hover:border-gold">
          <Boxes className="h-8 w-8 text-gold" />
          <h2 className="mt-4 font-display text-2xl">Stocks</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {isSuperAdmin
              ? "Tous les arrivages fournisseur."
              : "Vos arrivages — coût d'achat, frais de livraison, quantités."}
          </p>
          <span className="mt-4 inline-block text-xs uppercase tracking-[0.2em] text-gold group-hover:underline">
            Gérer →
          </span>
        </Link>

        {isSuperAdmin && (
          <>
            <Link to="/admin/categories" className="group block border border-border bg-card p-8 transition-colors hover:border-gold">
              <FolderTree className="h-8 w-8 text-gold" />
              <h2 className="mt-4 font-display text-2xl">Catégories</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Structure du catalogue — groupes (Bijoux, Beauté…) et catégories feuilles.
              </p>
              <span className="mt-4 inline-block text-xs uppercase tracking-[0.2em] text-gold group-hover:underline">
                Gérer →
              </span>
            </Link>

            <Link to="/admin/users" className="group block border border-border bg-card p-8 transition-colors hover:border-gold">
              <Users className="h-8 w-8 text-gold" />
              <h2 className="mt-4 font-display text-2xl">Utilisateurs</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Créez des comptes admin et leur attribuez les catégories qu'ils peuvent administrer.
              </p>
              <span className="mt-4 inline-block text-xs uppercase tracking-[0.2em] text-gold group-hover:underline">
                Gérer →
              </span>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
