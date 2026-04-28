// All catalog data is now sourced from the backend API.
// This module re-exports the API-driven Product type so any
// component still importing from `@/data/products` keeps working.

export type { Product, Section, ProductStatus } from "@/lib/api-types";
export { formatPrice, toProduct } from "@/lib/api-types";
export type Category =
  | "rings"
  | "bracelets"
  | "chains"
  | "watches"
  | "earrings"
  | "face"
  | "eyes"
  | "lips"
  | "tools"
  | string;
