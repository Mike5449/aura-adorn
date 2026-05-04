/**
 * Compact cart encoding for shareable URLs.
 *
 * Each cart item is reduced to its identifying ids — the destination
 * browser fetches the actual product data from /products/{id} so the
 * URL stays short and cannot be tampered with to inject fake prices.
 *
 * Wire format (after JSON + base64url):
 *   [{p: <product_id>, q: <qty>, s?: <size_id>, c?: <color_id>}, ...]
 */

import type { CartItem } from "@/context/CartContext";

interface CompactItem {
  p: number;
  q: number;
  s?: number;
  c?: number;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(encoded: string): Uint8Array {
  let s = encoded.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function encodeCart(items: CartItem[]): string {
  const payload: CompactItem[] = items.map((it) => {
    const o: CompactItem = { p: it.product.dbId, q: it.qty };
    if (it.selectedSizeId != null) o.s = it.selectedSizeId;
    if (it.selectedColorId != null) o.c = it.selectedColorId;
    return o;
  });
  const json = JSON.stringify(payload);
  // TextEncoder → UTF-8 bytes → base64url. Round-trips arbitrary chars
  // safely even though our data is ASCII-only.
  return base64UrlEncode(new TextEncoder().encode(json));
}

export function decodeCart(encoded: string): CompactItem[] {
  try {
    const json = new TextDecoder().decode(base64UrlDecode(encoded));
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    // Strip anything that doesn't match the expected shape; defensive
    // against malformed/tampered links.
    return parsed
      .filter(
        (x): x is CompactItem =>
          x && typeof x.p === "number" && typeof x.q === "number" && x.q > 0,
      )
      .map((x) => ({
        p: x.p,
        q: Math.min(99, Math.max(1, Math.floor(x.q))),
        s: typeof x.s === "number" ? x.s : undefined,
        c: typeof x.c === "number" ? x.c : undefined,
      }));
  } catch {
    return [];
  }
}

/**
 * Build the absolute URL a friend can open to receive the same cart.
 * Uses location.origin when available so it works on dev (localhost) and
 * prod (boteakelegans.com) without configuration.
 */
export function buildShareUrl(items: CartItem[]): string {
  const base =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://boteakelegans.com";
  return `${base}/cart?shared=${encodeCart(items)}`;
}

/**
 * Pretty-printed message body — used for the WhatsApp / email share.
 */
export function buildShareMessage(items: CartItem[], shareUrl: string): string {
  const lines = items.map((it) => {
    const opts: string[] = [];
    if (it.selectedSizeLabel) opts.push(`taille ${it.selectedSizeLabel}`);
    if (it.selectedColorLabel) opts.push(it.selectedColorLabel);
    const optStr = opts.length ? ` (${opts.join(", ")})` : "";
    return `• ${it.qty}× ${it.product.name}${optStr}`;
  });
  return [
    "Salut, regarde mon panier sur Beauté & Élégance :",
    "",
    ...lines,
    "",
    `Voir le panier : ${shareUrl}`,
  ].join("\n");
}
