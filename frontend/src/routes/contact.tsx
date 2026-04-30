import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { contactApi } from "@/lib/api";

// ---------------------------------------------------------------------------
// Coordonnées Beauté & Élégance
// ---------------------------------------------------------------------------
const PHONE_RAW = "50934705170";              // E.164 sans le « + », pour wa.me
const PHONE_DISPLAY = "+509 3470 5170";       // affichage humain
const EMAIL = "boteakelegans@boteakelegans.com";
const ADDRESS = "Delmas, Port-au-Prince, Haïti";
const WA_DEFAULT_MESSAGE = "Bonjour Beauté & Élégance, j'ai une question.";

const waLink = (msg = WA_DEFAULT_MESSAGE) =>
  `https://wa.me/${PHONE_RAW}?text=${encodeURIComponent(msg)}`;

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Beauté & Élégance" },
      { name: "description", content: "Contactez Beauté & Élégance — Delmas, Port-au-Prince. Téléphone, email, WhatsApp." },
      { property: "og:title", content: "Contact Beauté & Élégance" },
      { property: "og:description", content: "Téléphone, email, WhatsApp — joignez-nous facilement." },
    ],
  }),
  component: Contact,
});

const schema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(100),
  email: z.string().trim().email("Email valide requis").max(255),
  message: z.string().trim().min(1, "Message requis").max(1000),
});

function Contact() {
  const [form, setForm] = useState({ name: "", email: "", message: "", website: "" });
  const [sending, setSending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = schema.safeParse(form);
    if (!result.success) { toast.error(result.error.issues[0].message); return; }
    setSending(true);
    try {
      await contactApi.send(form);
      toast.success("Merci — votre message est arrivé. Nous reviendrons vers vous sous 24 h.");
      setForm({ name: "", email: "", message: "", website: "" });
    } catch (err: any) {
      toast.error(err?.message ?? "Échec de l'envoi. Réessayez ou contactez-nous via WhatsApp.");
    } finally {
      setSending(false);
    }
  };

  // « Envoyer sur WhatsApp » : ouvre WhatsApp avec un message pré-rempli
  // construit depuis le formulaire courant.
  const sendOnWhatsApp = () => {
    const result = schema.safeParse(form);
    if (!result.success) { toast.error(result.error.issues[0].message); return; }
    const msg =
      `Bonjour Beauté & Élégance,%0A%0A` +
      `Nom : ${form.name}%0A` +
      `Email : ${form.email}%0A%0A` +
      `${form.message}`;
    window.open(`https://wa.me/${PHONE_RAW}?text=${msg}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-20">
      <div className="text-center">
        <span className="text-xs uppercase tracking-[0.4em] text-gold">Concierge</span>
        <h1 className="mt-4 font-display text-5xl md:text-6xl">Nous Contacter</h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Pour un rendez-vous privé, une commande sur mesure ou toute demande, notre équipe est disponible 7j/7.
        </p>
      </div>

      <div className="mt-16 grid gap-12 lg:grid-cols-[1fr_1.2fr]">
        {/* Coordonnées + WhatsApp CTA */}
        <div className="space-y-10">
          {[
            { Icon: Mail,    label: "Email",     value: EMAIL,         href: `mailto:${EMAIL}` },
            { Icon: Phone,   label: "Téléphone", value: PHONE_DISPLAY, href: `tel:+${PHONE_RAW}` },
            { Icon: MapPin,  label: "Adresse",   value: ADDRESS,       href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ADDRESS)}` },
          ].map(({ Icon, label, value, href }) => (
            <a
              key={label}
              href={href}
              target={label === "Adresse" ? "_blank" : undefined}
              rel={label === "Adresse" ? "noopener noreferrer" : undefined}
              className="group flex gap-5 transition-colors"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-gold/40 text-gold transition-colors group-hover:bg-gold group-hover:text-primary-foreground">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gold">{label}</p>
                <p className="mt-1 text-foreground transition-colors group-hover:text-gold">{value}</p>
              </div>
            </a>
          ))}

          {/* WhatsApp direct */}
          <a
            href={waLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-4 border border-emerald-500/40 bg-emerald-500/5 p-5 transition-colors hover:border-emerald-500 hover:bg-emerald-500/10"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
              <MessageCircle className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">WhatsApp</p>
              <p className="mt-1 font-medium">Discuter en direct</p>
              <p className="text-xs text-muted-foreground">
                Réponse en quelques minutes durant nos heures d'ouverture.
              </p>
            </div>
            <span className="text-emerald-400 transition-transform group-hover:translate-x-1">→</span>
          </a>
        </div>

        {/* Formulaire */}
        <form onSubmit={submit} className="border border-border bg-card p-8 md:p-12">
          <div className="space-y-5">
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Nom</label>
              <input value={form.name} maxLength={100} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-2 w-full border border-border bg-background px-4 py-3 text-sm focus:border-gold focus:outline-none" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Email</label>
              <input type="email" value={form.email} maxLength={255} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-2 w-full border border-border bg-background px-4 py-3 text-sm focus:border-gold focus:outline-none" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Message</label>
              <textarea value={form.message} maxLength={1000} rows={6} onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="mt-2 w-full resize-none border border-border bg-background px-4 py-3 text-sm focus:border-gold focus:outline-none" />
            </div>

            {/* Honeypot — humans never see this; bots fill every field. */}
            <div aria-hidden="true" className="hidden">
              <label>Site web</label>
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
              />
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Button type="submit" variant="luxe" size="xl" className="w-full" disabled={sending}>
              {sending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Envoi…</>
              ) : (
                "Envoyer le Message"
              )}
            </Button>
            <Button
              type="button"
              size="xl"
              onClick={sendOnWhatsApp}
              className="w-full bg-emerald-500 text-white hover:bg-emerald-600"
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Envoyer sur WhatsApp
            </Button>
          </div>
          <p className="mt-3 text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            WhatsApp s'ouvrira avec votre message pré-rempli.
          </p>
        </form>
      </div>

      {/* Bouton flottant WhatsApp — disponible sur toutes les pages via la page contact */}
    </div>
  );
}
