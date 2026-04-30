import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, KeyRound, Loader2, Lock, Mail } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { authApi, type OtpChallengeResponse } from "@/lib/api";
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

const RESEND_COOLDOWN_SECONDS = 60;

type Stage =
  | { phase: "credentials" }
  | { phase: "otp"; challenge: OtpChallengeResponse; cooldown: number };

function LoginPage() {
  const { login, finishOtp } = useAuth();
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>({ phase: "credentials" });

  const goToHome = (role: string, username: string) => {
    toast.success("Bienvenue " + username);
    if (["super_admin", "admin", "manager"].includes(role)) {
      navigate({ to: "/admin" });
    } else {
      navigate({ to: "/" });
    }
  };

  if (stage.phase === "credentials") {
    return (
      <CredentialsForm
        onTokens={(user) => goToHome(user.role, user.username)}
        onOtpRequired={(challenge) =>
          setStage({ phase: "otp", challenge, cooldown: RESEND_COOLDOWN_SECONDS })
        }
        login={login}
      />
    );
  }

  return (
    <OtpForm
      challenge={stage.challenge}
      cooldown={stage.cooldown}
      setCooldown={(n) => setStage((s) => (s.phase === "otp" ? { ...s, cooldown: n } : s))}
      replaceChallenge={(c) =>
        setStage({ phase: "otp", challenge: c, cooldown: RESEND_COOLDOWN_SECONDS })
      }
      cancel={() => setStage({ phase: "credentials" })}
      finishOtp={finishOtp}
      onSuccess={(user) => goToHome(user.role, user.username)}
    />
  );
}

// ---------------------------------------------------------------------------
// Step 1 — username + password
// ---------------------------------------------------------------------------

function CredentialsForm({
  login,
  onTokens,
  onOtpRequired,
}: {
  login: ReturnType<typeof useAuth>["login"];
  onTokens: (user: { username: string; role: string }) => void;
  onOtpRequired: (c: OtpChallengeResponse) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await login(username, password);
      if (result.kind === "otp") {
        onOtpRequired(result.challenge);
        toast.info(`Code envoyé à ${result.challenge.email_hint}.`);
      } else {
        onTokens(result.user);
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

// ---------------------------------------------------------------------------
// Step 2 — 6-digit code from email
// ---------------------------------------------------------------------------

function OtpForm({
  challenge,
  cooldown,
  setCooldown,
  replaceChallenge,
  cancel,
  finishOtp,
  onSuccess,
}: {
  challenge: OtpChallengeResponse;
  cooldown: number;
  setCooldown: (n: number) => void;
  replaceChallenge: (c: OtpChallengeResponse) => void;
  cancel: () => void;
  finishOtp: (challengeId: string, code: string) => Promise<{ username: string; role: string }>;
  onSuccess: (user: { username: string; role: string }) => void;
}) {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Focus the code input on mount; tick down the resend cooldown every second.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => {
      setCooldown(Math.max(0, cooldown - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [cooldown, setCooldown]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      toast.error("Le code doit comporter 6 chiffres.");
      return;
    }
    setSubmitting(true);
    try {
      const me = await finishOtp(challenge.challenge_id, code);
      onSuccess(me);
    } catch (e: any) {
      toast.error(e?.message ?? "Code invalide");
      setCode("");
      inputRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  const onResend = async () => {
    if (cooldown > 0) return;
    setResending(true);
    try {
      const r = await authApi.resendOtp(challenge.challenge_id);
      replaceChallenge({
        ...challenge,
        expires_in_seconds: r.expires_in_seconds,
      });
      toast.success("Nouveau code envoyé.");
    } catch (e: any) {
      toast.error(e?.message ?? "Impossible de renvoyer le code");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-6 py-24">
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center border border-gold/40 text-gold">
          <KeyRound className="h-5 w-5" />
        </div>
        <h1 className="mt-6 font-display text-4xl">Vérification</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          <Mail className="mr-1 inline h-3.5 w-3.5" />
          Un code à 6 chiffres a été envoyé à{" "}
          <strong className="text-foreground">{challenge.email_hint}</strong>.
          <br />
          Il expire dans 10 minutes.
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-12 space-y-4">
        <label className="block">
          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Code de vérification</span>
          <input
            ref={inputRef}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            placeholder="••••••"
            className="mt-2 w-full border border-border bg-background px-3 py-4 text-center text-3xl font-semibold tracking-[0.5em] focus:border-gold focus:outline-none"
          />
        </label>

        <Button
          variant="luxe"
          size="xl"
          type="submit"
          disabled={submitting || code.length !== 6}
          className="mt-6 w-full"
        >
          {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Vérification…</> : "Valider"}
        </Button>
      </form>

      <div className="mt-6 flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={cancel}
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-gold"
        >
          <ArrowLeft className="h-3 w-3" />
          Recommencer
        </button>
        <button
          type="button"
          onClick={onResend}
          disabled={cooldown > 0 || resending}
          className="text-gold hover:text-foreground disabled:cursor-not-allowed disabled:text-muted-foreground/60"
        >
          {resending ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Envoi…
            </span>
          ) : cooldown > 0 ? (
            `Renvoyer dans ${cooldown}s`
          ) : (
            "Renvoyer le code"
          )}
        </button>
      </div>

      <p className="mt-10 text-center text-xs text-muted-foreground">
        <Link to="/" className="hover:text-gold">← Retour à la boutique</Link>
      </p>
    </div>
  );
}
