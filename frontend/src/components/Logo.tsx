import { Link } from "@tanstack/react-router";

/**
 * Brand mark + wordmark for « Beauté & Élégance ».
 *
 * The SVG is a thin-line diamond — works for both the jewelry side and the
 * beauty side, scales cleanly, and uses `currentColor` so it picks up the
 * accent automatically (gold on dark theme, red on light).
 *
 * The wordmark itself is broken in three pieces so we can give the
 * ampersand its own italic + accent weight without rewriting the
 * surrounding markup wherever the brand appears.
 */

interface LogoProps {
  size?: "sm" | "md" | "lg";
  asLink?: boolean;
  className?: string;
}

const SIZES = {
  sm: { mark: "h-6 w-6", text: "text-base sm:text-lg", gap: "gap-2" },
  md: { mark: "h-7 w-7 sm:h-8 sm:w-8", text: "text-lg sm:text-xl md:text-2xl", gap: "gap-2.5" },
  lg: { mark: "h-10 w-10 md:h-12 md:w-12", text: "text-2xl md:text-3xl", gap: "gap-3" },
};

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Diamond outline */}
      <path d="M16 3 L27 13 L16 29 L5 13 Z" />
      {/* Top facet */}
      <path d="M5 13 L27 13" strokeWidth="0.8" />
      {/* Inner crown lines */}
      <path d="M16 3 L11 13 M16 3 L21 13" strokeWidth="0.6" opacity="0.7" />
      {/* Inner pavilion lines */}
      <path d="M11 13 L16 29 M21 13 L16 29" strokeWidth="0.6" opacity="0.7" />
    </svg>
  );
}

export default function Logo({ size = "md", asLink = true, className = "" }: LogoProps) {
  const s = SIZES[size];
  const inner = (
    <span className={`inline-flex items-center ${s.gap} whitespace-nowrap ${className}`}>
      <LogoMark className={`shrink-0 text-[var(--gold)] ${s.mark}`} />
      <span className={`font-display tracking-[0.02em] text-foreground ${s.text}`}>
        <span className="font-medium">Beauté</span>
        <span className="mx-[0.2em] italic text-[var(--gold)] font-light">&amp;</span>
        <span className="italic font-light">Élégance</span>
      </span>
    </span>
  );
  if (!asLink) return inner;
  return (
    <Link to="/" aria-label="Beauté & Élégance — Accueil" className="inline-flex items-center">
      {inner}
    </Link>
  );
}
