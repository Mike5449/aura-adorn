// Shapes returned by the backend API. Mirrors backend Pydantic responses.

export type Section = "jewelry" | "beauty";
export type ProductStatus = "available" | "coming_soon";
export type OrderStatus = "pending" | "paid" | "shipped" | "delivered" | "cancelled";
export type PaymentStatus = "pending" | "success" | "failed";

export interface ApiCategory {
  id: number;
  slug: string;
  name: string;
  section: Section;
  display_order: number;
}

export interface ApiProductSize {
  id: number;
  size_label: string;
  stock: number;
  is_active: boolean;
}

export interface ApiProduct {
  id: number;
  slug: string;
  name: string;
  description: string;
  price: string; // Decimal serialized as string
  image_url: string;
  category_id: number;
  section: Section;
  status: ProductStatus;
  is_bestseller: boolean;
  is_active: boolean;
  has_sizes: boolean;
  stock: number;
  sizes: ApiProductSize[];
}

export interface ApiOrderItem {
  id: number;
  product_id: number | null;
  product_size_id: number | null;
  product_name: string;
  size_label: string | null;
  quantity: number;
  unit_price: string;
}

export interface ApiOrder {
  id: number;
  order_number: string;
  user_id: number | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  customer_city: string;
  notes: string | null;
  delivery_requested: boolean;
  delivery_fee: string;
  subtotal: string | null;
  total_amount: string;
  currency: string;
  status: OrderStatus;
  payment_method: string;
  payment_status: PaymentStatus;
  payment_reference: string | null;
  items: ApiOrderItem[];
  created_at: string;
  updated_at: string;
}

// Delivery business rules — keep in sync with backend `core/config.py`
export const DELIVERY_FEE_HTG = 150;
export const FREE_DELIVERY_THRESHOLD_HTG = 2500;
export const DELIVERY_CITY = "Delmas";

export function computeDeliveryFee(subtotal: number, requested: boolean): number {
  if (!requested) return 0;
  if (subtotal >= FREE_DELIVERY_THRESHOLD_HTG) return 0;
  return DELIVERY_FEE_HTG;
}

export function isDeliveryEligibleCity(city: string): boolean {
  return city.trim().toLowerCase().includes(DELIVERY_CITY.toLowerCase());
}

export interface ApiPaymentInitiate {
  order_id: number;
  order_number: string;
  amount: string;
  currency: string;
  payment_token: string;
  redirect_url: string;
}

export interface ApiUser {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
  role: "admin" | "manager" | "staff";
}

export interface ApiTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

// ---------------------------------------------------------------------------
// Storefront-friendly Product shape — used by the existing UI components.
// We keep the original interface name so cards/cart code keeps working.
// ---------------------------------------------------------------------------
export interface Product {
  id: string;        // slug (used in URLs and as cart key seed)
  dbId: number;      // numeric primary key (used for orders / admin)
  name: string;
  description: string;
  price: number;
  image: string;
  section: Section;
  category: string;  // category slug (e.g. "rings")
  categoryName?: string;
  categoryId: number;
  bestseller: boolean;
  status: ProductStatus;
  hasSizes: boolean;
  sizes: ApiProductSize[];
  stock: number;
}

export function toProduct(p: ApiProduct, categories?: ApiCategory[]): Product {
  const cat = categories?.find((c) => c.id === p.category_id);
  return {
    id: p.slug,
    dbId: p.id,
    name: p.name,
    description: p.description,
    price: Number(p.price),
    image: p.image_url,
    section: p.section,
    category: cat?.slug ?? String(p.category_id),
    categoryName: cat?.name,
    categoryId: p.category_id,
    bestseller: p.is_bestseller,
    status: p.status,
    hasSizes: p.has_sizes,
    sizes: p.sizes ?? [],
    stock: p.stock,
  };
}

export const formatPrice = (n: number, currency = "HTG") =>
  currency === "HTG"
    ? `${n.toLocaleString("fr-HT", { maximumFractionDigits: 2 })} HTG`
    : `${n.toFixed(2)} ${currency}`;
