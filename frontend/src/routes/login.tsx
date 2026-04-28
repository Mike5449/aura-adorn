import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Lock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Connexion — Beauté & Élégance" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const me = await login(username, password);
      toast.success("Bienvenue " + me.username);
      if (me.role === "admin" || me.role === "manager") {
        navigate({ to: "/admin" });
      } else {
        navigate({ to: "/" });
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Identifiants invalides");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-6 py-24">
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center border border-gold/40 text-gold">
          <Lock className="h-5 w-5" />
        </div>
        <h1 className="mt-6 font-display text-4xl">Connexion</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Espace privé — administration de la boutique.
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-12 space-y-4">
        <label className="block">
          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Identifiant</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
            className="mt-2 w-full border border-border bg-background px-3 py-3 text-sm focus:border-gold focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Mot de passe</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="mt-2 w-full border border-border bg-background px-3 py-3 text-sm focus:border-gold focus:outline-none"
          />
        </label>

        <Button variant="luxe" size="xl" type="submit" disabled={submitting} className="mt-6 w-full">
          {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Connexion…</> : "Se connecter"}
        </Button>
      </form>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        <Link to="/" className="hover:text-gold">← Retour à la boutique</Link>
      </p>
    </div>
  );
}
