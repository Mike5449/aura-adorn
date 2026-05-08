import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Politique de confidentialité — Beauté & Élégance" },
      {
        name: "description",
        content:
          "Comment Beauté & Élégance collecte, utilise et protège vos données personnelles lors de vos commandes en ligne.",
      },
    ],
  }),
  component: PrivacyPage,
});

const LAST_UPDATED = "8 mai 2026";

function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16">
      <header className="text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-gold">Confidentialité</p>
        <h1 className="mt-3 font-display text-4xl md:text-5xl">
          Politique de confidentialité
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Dernière mise à jour : {LAST_UPDATED}
        </p>
      </header>

      <div className="gold-divider mx-auto mt-8 max-w-xs" />

      <Lead>
        Cette politique explique <strong>quelles données nous collectons</strong>,{" "}
        <strong>pourquoi</strong>, <strong>avec qui elles sont partagées</strong>, et
        comment vous pouvez exercer vos droits. Elle couvre uniquement notre site{" "}
        <code className="text-foreground">boteakelegans.com</code> et notre boutique en
        ligne « Beauté & Élégance ».
      </Lead>

      <Section title="1. Qui sommes-nous">
        <p>
          <strong>Beauté & Élégance</strong> est une boutique de bijoux, parfums et
          produits de beauté basée à Delmas, Port-au-Prince, Haïti.
        </p>
        <p>
          Pour toute question relative à vos données :
        </p>
        <ul className="ml-5 mt-2 list-disc space-y-1">
          <li>
            Email :{" "}
            <a
              href="mailto:boteakelegans@boteakelegans.com"
              className="text-gold underline-offset-4 hover:underline"
            >
              boteakelegans@boteakelegans.com
            </a>
          </li>
          <li>
            WhatsApp :{" "}
            <a
              href="https://wa.me/50934705170"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold underline-offset-4 hover:underline"
            >
              +509 3470 5170
            </a>
          </li>
        </ul>
      </Section>

      <Section title="2. Données que nous collectons">
        <p>
          Nous collectons strictement les données nécessaires au fonctionnement de
          la boutique. Aucune donnée n'est revendue à des tiers à des fins
          commerciales.
        </p>

        <h3 className="mt-5 text-sm font-medium uppercase tracking-[0.2em] text-gold">
          Lors d'une commande
        </h3>
        <ul className="mt-2 ml-5 list-disc space-y-1">
          <li>Nom complet (obligatoire)</li>
          <li>Numéro de téléphone (obligatoire — utilisé par MonCash)</li>
          <li>Adresse + ville de livraison (obligatoires)</li>
          <li>
            Adresse email (<strong>facultative</strong> — uniquement pour vous
            envoyer la confirmation de commande)
          </li>
          <li>Notes de commande (facultatif, si vous précisez quelque chose)</li>
        </ul>

        <h3 className="mt-5 text-sm font-medium uppercase tracking-[0.2em] text-gold">
          Lors du paiement
        </h3>
        <p className="mt-2">
          Le paiement est entièrement géré par <strong>MonCash (Digicel)</strong>.
          Nous <strong>ne voyons jamais</strong> votre code MonCash, votre solde, ni
          aucun détail bancaire. MonCash nous transmet uniquement un identifiant de
          transaction et la confirmation que le paiement a réussi.
        </p>

        <h3 className="mt-5 text-sm font-medium uppercase tracking-[0.2em] text-gold">
          Lors d'une visite
        </h3>
        <ul className="mt-2 ml-5 list-disc space-y-1">
          <li>
            Adresse IP et navigateur — enregistrés temporairement dans nos logs
            serveur pour la sécurité (détection d'abus, dépannage).
          </li>
          <li>
            Données techniques de session stockées <strong>localement dans
            votre navigateur</strong> (panier en cours, thème choisi, jeton de
            connexion si vous êtes administrateur). Ces données ne sont jamais
            envoyées à nos serveurs sauf au moment où vous validez une action
            (passer commande, vous connecter).
          </li>
        </ul>

        <h3 className="mt-5 text-sm font-medium uppercase tracking-[0.2em] text-gold">
          Pour nous contacter
        </h3>
        <p className="mt-2">
          Si vous utilisez le formulaire de contact, nous conservons votre
          message, votre nom et l'email que vous indiquez, le temps nécessaire
          pour vous répondre.
        </p>
      </Section>

      <Section title="3. Pourquoi nous utilisons ces données">
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Traiter votre commande</strong> et organiser la livraison.
          </li>
          <li>
            <strong>Vous tenir informé</strong> du statut de la commande (par email
            si fourni, sinon par WhatsApp / téléphone).
          </li>
          <li>
            <strong>Sécuriser le site</strong> : limiter les tentatives de fraude,
            les abus du formulaire de contact, et les connexions administrateur
            non autorisées (mot de passe + code à usage unique par email).
          </li>
          <li>
            <strong>Améliorer notre service</strong> à partir de statistiques
            agrégées (par exemple : quels produits sont les plus consultés). Aucune
            donnée individuelle n'est utilisée à cette fin.
          </li>
        </ul>
      </Section>

      <Section title="4. Avec qui vos données sont partagées">
        <p>Nous travaillons avec un nombre minimal de prestataires techniques :</p>
        <ul className="mt-2 ml-5 list-disc space-y-2">
          <li>
            <strong>Digicel — MonCash</strong> : reçoit le montant et l'identifiant
            de votre commande pour traiter le paiement. Soumis à la politique de
            confidentialité de Digicel.
          </li>
          <li>
            <strong>Hostinger</strong> : héberge notre boîte email
            (boteakelegans@boteakelegans.com) et notre serveur. C'est par leur
            intermédiaire que les emails de confirmation vous parviennent.
          </li>
          <li>
            <strong>Votre opérateur télécom</strong> si vous nous contactez par
            WhatsApp ou SMS — la conversation suit alors les conditions de
            l'application utilisée.
          </li>
        </ul>
        <p className="mt-3 text-sm">
          Nous <strong>ne vendons</strong> ni ne <strong>louons</strong> jamais vos
          données à des annonceurs ou à des tiers.
        </p>
      </Section>

      <Section title="5. Combien de temps nous gardons vos données">
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Commandes</strong> : conservées pendant la durée légale de
            tenue des registres comptables, puis archivées.
          </li>
          <li>
            <strong>Messages de contact</strong> : supprimés une fois la demande
            traitée (généralement sous 30 jours).
          </li>
          <li>
            <strong>Logs serveur (IP, requêtes)</strong> : conservés au maximum
            30 jours, ensuite effacés automatiquement.
          </li>
          <li>
            <strong>Données dans votre navigateur</strong> (panier, thème) :
            vous pouvez les effacer à tout moment via les paramètres de votre
            navigateur.
          </li>
        </ul>
      </Section>

      <Section title="6. Cookies et stockage local">
        <p>
          Le site n'utilise <strong>aucun cookie publicitaire ni traceur tiers</strong>
          (pas de Google Analytics, pas de Facebook Pixel, pas de remarketing).
        </p>
        <p className="mt-3">
          Nous utilisons uniquement le <em>localStorage</em> de votre navigateur,
          pour mémoriser :
        </p>
        <ul className="mt-2 ml-5 list-disc space-y-1">
          <li>Votre panier en cours</li>
          <li>Votre choix de thème (clair / sombre)</li>
          <li>
            Votre jeton de connexion si vous êtes administrateur (stocké en clair
            dans votre navigateur seulement)
          </li>
        </ul>
        <p className="mt-3">
          Ces informations restent <strong>sur votre appareil</strong> et ne sont
          envoyées à nos serveurs qu'au moment où vous validez une action
          (commande, connexion).
        </p>
      </Section>

      <Section title="7. Comment nous protégeons vos données">
        <ul className="ml-5 list-disc space-y-1">
          <li>
            Le site est servi <strong>uniquement en HTTPS</strong> ; aucune
            donnée ne transite en clair.
          </li>
          <li>
            Les <strong>mots de passe administrateur</strong> sont hachés (bcrypt)
            avant d'être stockés — même nous ne pouvons pas les lire.
          </li>
          <li>
            Les connexions administrateur exigent un <strong>code à 6 chiffres
            envoyé par email</strong> (authentification à deux facteurs).
          </li>
          <li>
            Les paiements MonCash sont vérifiés côté serveur ; les liens partagés
            de panier ne contiennent que des références produit, jamais de prix
            ni de données client.
          </li>
        </ul>
      </Section>

      <Section title="8. Vos droits">
        <p>
          Vous pouvez à tout moment demander :
        </p>
        <ul className="mt-2 ml-5 list-disc space-y-1">
          <li>
            <strong>Accéder</strong> aux données que nous avons sur vous.
          </li>
          <li>
            <strong>Corriger</strong> une information erronée (nom mal orthographié,
            mauvaise adresse…).
          </li>
          <li>
            <strong>Supprimer</strong> votre historique de commandes (sous réserve
            des obligations comptables).
          </li>
        </ul>
        <p className="mt-3">
          Pour exercer ces droits, écrivez-nous à{" "}
          <a
            href="mailto:boteakelegans@boteakelegans.com"
            className="text-gold underline-offset-4 hover:underline"
          >
            boteakelegans@boteakelegans.com
          </a>
          . Nous répondons sous 7 jours ouvrés.
        </p>
      </Section>

      <Section title="9. Modifications de cette politique">
        <p>
          Nous pouvons mettre à jour cette politique pour refléter une évolution
          du site ou de la loi. La date de la dernière mise à jour figure en haut
          de la page. Nous vous recommandons de la consulter de temps à autre.
        </p>
      </Section>

      <div className="mt-12 border-t border-border pt-8 text-center">
        <p className="text-xs text-muted-foreground">
          Une question sur cette politique ?{" "}
          <Link to="/contact" className="text-gold underline-offset-4 hover:underline">
            Contactez-nous
          </Link>
          .
        </p>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Tiny presentational helpers — keep the body of the page readable.
// ---------------------------------------------------------------------------

function Lead({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-10 border-l-2 border-gold/60 pl-4 text-base leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-xl text-foreground md:text-2xl">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}
