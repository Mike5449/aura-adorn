import { Link } from "@tanstack/react-router";
import { ShoppingBag, Menu, X, Search, Shield, LogOut, LogIn } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

const nav = [
  { to: "/", label: "Accueil" },
  { to: "/shop", label: "Boutique" },
  { to: "/shop", label: "Bijoux Homme", search: { section: "jewelry" as const, category: "all" } },
  { to: "/shop", label: "Beauté", search: { section: "beauty" as const, category: "all" } },
  { to: "/contact", label: "Contact" },
];

export default function Header() {
  const { count, setOpen } = useCart();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const showAdminLink = user?.role === "admin" || user?.role === "manager";

  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2 whitespace-nowrap">
          <span className="font-display text-lg tracking-[0.18em] text-foreground sm:text-xl md:text-2xl">
            CARAT <span className="text-gold">&amp; COULEUR</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-10 md:flex">
          {nav.map((n, i) => (
            <Link
              key={i}
              to={n.to}
              search={n.search as never}
              className="text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-gold"
              activeProps={{ className: "text-gold" }}
              activeOptions={{ exact: true, includeSearch: false }}
            >
              {n.label}
            </Link>
          ))}
          {showAdminLink && (
            <Link
              to="/admin"
              className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.2em] text-gold transition-colors hover:text-foreground"
            >
              <Shield className="h-3.5 w-3.5" /> Admin
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="hidden md:inline-flex text-muted-foreground hover:text-gold" aria-label="Rechercher">
            <Search className="h-4 w-4" />
          </Button>
          {user ? (
            <button
              onClick={logout}
              className="hidden md:inline-flex h-9 w-9 items-center justify-center text-muted-foreground transition-colors hover:text-gold"
              title={`Se déconnecter (${user.username})`}
              aria-label="Se déconnecter"
            >
              <LogOut className="h-4 w-4" />
            </button>
          ) : (
            <Link
              to="/login"
              className="hidden md:inline-flex h-9 w-9 items-center justify-center text-muted-foreground transition-colors hover:text-gold"
              title="Se connecter"
              aria-label="Se connecter"
            >
              <LogIn className="h-4 w-4" />
            </Link>
          )}
          <button
            onClick={() => setOpen(true)}
            className="relative inline-flex h-9 w-9 items-center justify-center text-muted-foreground transition-colors hover:text-gold"
            aria-label="Ouvrir le panier"
          >
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-primary-foreground">
                {count}
              </span>
            )}
          </button>
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="ml-1 inline-flex h-9 w-9 items-center justify-center text-muted-foreground md:hidden"
            aria-label="Menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-border/40 bg-background md:hidden">
          <nav className="flex flex-col px-6 py-4">
            {nav.map((n, i) => (
              <Link
                key={i}
                to={n.to}
                search={n.search as never}
                onClick={() => setMobileOpen(false)}
                className="py-3 text-sm uppercase tracking-[0.2em] text-muted-foreground hover:text-gold"
              >
                {n.label}
              </Link>
            ))}
            {showAdminLink && (
              <Link
                to="/admin"
                onClick={() => setMobileOpen(false)}
                className="py-3 text-sm uppercase tracking-[0.2em] text-gold"
              >
                Admin
              </Link>
            )}
            {user ? (
              <button
                onClick={() => { logout(); setMobileOpen(false); }}
                className="py-3 text-left text-sm uppercase tracking-[0.2em] text-muted-foreground hover:text-gold"
              >
                Se déconnecter ({user.username})
              </button>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className="py-3 text-sm uppercase tracking-[0.2em] text-muted-foreground hover:text-gold"
              >
                Se connecter
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
