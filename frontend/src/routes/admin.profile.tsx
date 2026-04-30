import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Save, KeyRound, Mail, AtSign, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { userApi } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, refresh } = useAuth();

  if (!user) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-3xl">Mon profil</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Mettez à jour votre adresse email ou changez votre mot de passe.
      </p>
      <div className="gold-divider my-6" />

      <div className="grid gap-8 lg:grid-cols-2">
        <ReadOnlyCard user={user} />
        <EmailCard user={user} onSaved={refresh} />
        <PasswordCard onSaved={refresh} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ReadOnlyCard({
  user,
}: {
  user: { username: string; role: string; email: string };
}) {
  return (
    <div className="border border-border bg-card p-6">
      <h2 className="text-xs uppercase tracking-[0.3em] text-gold">Compte</h2>
      <div className="mt-5 space-y-4 text-sm">
        <Row icon={<AtSign className="h-4 w-4" />} label="Identifiant" value={user.username} />
        <Row icon={<Mail className="h-4 w-4" />} label="Email actuel" value={user.email} />
        <Row icon={<ShieldCheck className="h-4 w-4" />} label="Rôle" value={user.role} mono />
      </div>
      <p className="mt-6 text-[11px] text-muted-foreground">
        L'identifiant et le rôle ne sont pas modifiables par vous-même.
        {" "}Pour les changer, demandez au super-admin.
      </p>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="flex-1">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
        <p className={`mt-0.5 ${mono ? "font-mono text-xs uppercase tracking-widest text-gold" : ""}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function EmailCard({
  user,
  onSaved,
}: {
  user: { email: string };
  onSaved: () => Promise<void>;
}) {
  const [email, setEmail] = useState(user.email);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim() === user.email) {
      toast.info("L'adresse email n'a pas changé.");
      return;
    }
    setSaving(true);
    try {
      await userApi.updateMe({ email: email.trim() });
      await onSaved();
      toast.success("Email mis à jour.");
    } catch (e: any) {
      toast.error(e?.message ?? "Échec de la mise à jour.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="border border-border bg-card p-6">
      <h2 className="text-xs uppercase tracking-[0.3em] text-gold">Adresse email</h2>
      <p className="mt-2 text-[11px] text-muted-foreground">
        L'adresse où vous recevez les codes de vérification (OTP) à chaque connexion.
        Choisissez une boîte que vous consultez régulièrement.
      </p>

      <label className="mt-5 block">
        <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Nouvelle adresse</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className={input}
        />
      </label>

      <Button type="submit" variant="luxe" size="lg" disabled={saving} className="mt-5 w-full">
        {saving ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enregistrement…</>
        ) : (
          <><Save className="mr-2 h-4 w-4" /> Mettre à jour l'email</>
        )}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------

function PasswordCard({ onSaved }: { onSaved: () => Promise<void> }) {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirm) {
      toast.error("Le nouveau mot de passe et la confirmation ne correspondent pas.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    setSaving(true);
    try {
      await userApi.updateMe({
        password: newPassword,
        current_password: currentPassword,
      });
      await onSaved();
      setCurrent("");
      setNew("");
      setConfirm("");
      toast.success("Mot de passe mis à jour.");
    } catch (e: any) {
      toast.error(e?.message ?? "Échec — vérifiez votre mot de passe actuel.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="border border-border bg-card p-6 lg:col-span-2">
      <h2 className="text-xs uppercase tracking-[0.3em] text-gold">Mot de passe</h2>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Pour des raisons de sécurité, votre mot de passe actuel est demandé pour confirmer le changement.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <label className="block">
          <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Mot de passe actuel</span>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrent(e.target.value)}
            required
            autoComplete="current-password"
            className={input}
          />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Nouveau mot de passe</span>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNew(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className={input}
          />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Confirmer</span>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className={input}
          />
        </label>
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        8 caractères minimum, mélange recommandé : lettres, chiffres et au moins un caractère spécial.
      </p>

      <Button type="submit" variant="luxe" size="lg" disabled={saving} className="mt-5 w-full md:w-auto">
        {saving ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enregistrement…</>
        ) : (
          <><KeyRound className="mr-2 h-4 w-4" /> Changer mon mot de passe</>
        )}
      </Button>
    </form>
  );
}

const input =
  "mt-2 w-full border border-border bg-background px-3 py-2 text-sm focus:border-gold focus:outline-none";
