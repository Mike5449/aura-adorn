import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/context/AuthContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { ThemeProvider } from "@/context/ThemeContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import WhatsAppButton from "@/components/WhatsAppButton";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl text-gold">404</h1>
        <h2 className="mt-4 font-display text-2xl">Page introuvable</h2>
        <p className="mt-2 text-sm text-muted-foreground">La page que vous cherchez n'existe pas.</p>
        <div className="mt-8">
          <Link to="/" className="border border-gold px-8 py-3 text-xs uppercase tracking-[0.25em] text-gold transition-colors hover:bg-gold hover:text-primary-foreground">
            Retour à l'Accueil
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Beauté & Élégance — Bijoux, Maquillage & Soin de la Peau" },
      { name: "description", content: "Beauté & Élégance : bijoux précieux, maquillage haute pigmentation et soins de la peau — l'art complet de se mettre en valeur." },
      { property: "og:title", content: "Beauté & Élégance — Bijoux & Beauté" },
      { property: "og:description", content: "Bijoux, maquillage et soin de la peau de qualité." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  // Inline script runs before React hydrates so we apply the persisted theme
  // immediately and avoid a flash of the wrong palette on first paint.
  const themeBootstrap = `
    (function () {
      try {
        var t = window.localStorage.getItem('maison_theme');
        if (t === 'dark') document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
      } catch (e) {}
    })();
  `.trim();

  return (
    <html lang="fr">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SettingsProvider>
          <CartProvider>
            <div className="flex min-h-screen flex-col">
              <Header />
              <main className="flex-1"><Outlet /></main>
              <Footer />
              <CartDrawer />
              <WhatsAppButton />
              <Toaster />
            </div>
          </CartProvider>
        </SettingsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
