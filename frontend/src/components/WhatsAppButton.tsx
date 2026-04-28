// Petit bouton flottant ouvrant WhatsApp dans un nouvel onglet.
// Affiché sur toutes les pages depuis __root.tsx.

const WHATSAPP_NUMBER = "50934705170"; // E.164 sans le « + »
const DEFAULT_MESSAGE = "Bonjour Carat & Couleur, j'ai une question.";

export default function WhatsAppButton() {
  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(DEFAULT_MESSAGE)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Nous contacter sur WhatsApp"
      title="Nous contacter sur WhatsApp"
      className="group fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_8px_30px_rgba(16,185,129,0.35)] transition-all hover:scale-105 hover:bg-emerald-600 hover:shadow-[0_8px_40px_rgba(16,185,129,0.55)] sm:h-16 sm:w-16"
    >
      {/* Pulse ring */}
      <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-emerald-500/40" />

      {/* WhatsApp glyph (inline SVG so we don't depend on lucide for the brand mark) */}
      <svg
        viewBox="0 0 32 32"
        className="h-7 w-7 fill-current sm:h-8 sm:w-8"
        aria-hidden="true"
      >
        <path d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 01-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 01-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.09-.832-2.335-.143-.372-.214-.487-.6-.487-.187 0-.36-.043-.53-.043-.302 0-.53.115-.746.315-.688.645-1.032 1.318-1.06 2.264v.114c-.015.99.472 1.977 1.017 2.78 1.23 1.82 2.434 3.41 4.34 4.456.616.343 2.193 1.017 2.78 1.017l.057-.007a3.18 3.18 0 002.378-1.348c.143-.272.215-.602.215-.917 0-.272-1.39-.962-1.604-1.06-.143-.075-.301-.115-.46-.115zM16.064 6.097c-5.466 0-9.92 4.453-9.92 9.92 0 1.873.53 3.7 1.519 5.276l-.99 3.642 3.748-.978a9.954 9.954 0 005.617 1.733c5.466 0 9.92-4.452 9.92-9.92 0-1.39-.286-2.736-.832-4.011a9.875 9.875 0 00-3.08-3.665 9.962 9.962 0 00-5.982-1.997zM16.05 24a8.05 8.05 0 01-4.554-1.408l-.314-.187-2.78.74.755-2.722-.205-.32a8.005 8.005 0 01-1.246-4.327c0-4.382 3.598-7.967 7.953-7.967a7.91 7.91 0 015.617 2.336 7.99 7.99 0 012.349 5.617c0 4.354-3.586 7.967-7.967 7.967z" />
      </svg>
    </a>
  );
}
