import type {
  ApiCategory,
  ApiOrder,
  ApiPaymentInitiate,
  ApiProduct,
  ApiTokens,
  ApiUser,
  OrderStatus,
  ProductStatus,
} from "./api-types";

// In the browser we hit `/api/*` and let the edge nginx proxy forward
// to the backend. During SSR (Node, no `window`), `/api/*` is not a
// valid URL — we must call the backend directly via the docker-compose
// network. SSR_API_URL is injected by docker-compose (or defaults to
// http://backend:8000 inside the cluster).
function resolveApiBase(): string {
  if (typeof window === "undefined") {
    // Server side
    if (typeof process !== "undefined" && process.env?.SSR_API_URL) {
      return process.env.SSR_API_URL;
    }
    return "http://backend:8000";
  }
  // Browser side
  return (
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_URL) ||
    "/api"
  );
}

const API_BASE: string = resolveApiBase();

/**
 * Resolve an image URL stored in the catalog into something the browser can load.
 *
 * - Absolute URLs (`http://…`, `https://…`, `data:…`) are returned as-is.
 * - Backend-served paths (`/media/*` — uploaded images) get the API base prepended.
 * - Other paths (e.g. `/assets/*`) stay relative — Vite's `public/` directory serves them.
 */
export function resolveImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (/^(https?:|data:|blob:)/.test(url)) return url;
  if (url.startsWith("/media/")) return `${API_BASE}${url}`;
  return url;
}

export const API_URL = API_BASE;

const TOKEN_KEY = "maison_token";
const REFRESH_KEY = "maison_refresh";

// ---------------------------------------------------------------------------
// Token storage (localStorage on the browser, no-op on the server)
// ---------------------------------------------------------------------------

export const tokenStorage = {
  get(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(TOKEN_KEY);
  },
  getRefresh(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh?: string | null) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(TOKEN_KEY, access);
    if (refresh) window.localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  },
};

// ---------------------------------------------------------------------------
// Low-level fetch wrapper
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  status: number;
  body: any;
  constructor(status: number, message: string, body: any) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

interface ApiOptions extends RequestInit {
  auth?: boolean;
  formBody?: Record<string, string>;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const { auth = false, formBody, headers, body, ...rest } = options;

  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(headers as Record<string, string> | undefined),
  };

  let finalBody: BodyInit | undefined;
  if (formBody) {
    finalHeaders["Content-Type"] = "application/x-www-form-urlencoded";
    finalBody = new URLSearchParams(formBody).toString();
  } else if (body !== undefined) {
    finalHeaders["Content-Type"] ??= "application/json";
    finalBody = typeof body === "string" ? body : JSON.stringify(body);
  }

  if (auth) {
    const token = tokenStorage.get();
    if (token) finalHeaders["Authorization"] = `Bearer ${token}`;
  }

  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...rest,
    headers: finalHeaders,
    body: finalBody,
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const message =
      (data && typeof data === "object" && (data.detail || data.message)) ||
      res.statusText ||
      "API error";
    throw new ApiError(res.status, String(message), data);
  }
  return data as T;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const authApi = {
  async login(username: string, password: string): Promise<ApiTokens> {
    const tokens = await apiFetch<ApiTokens>("/token", {
      method: "POST",
      formBody: { username, password },
    });
    tokenStorage.set(tokens.access_token, tokens.refresh_token);
    return tokens;
  },
  async me(): Promise<ApiUser> {
    return apiFetch<ApiUser>("/users/me", { auth: true });
  },
  logout() {
    tokenStorage.clear();
  },
};

// ---------------------------------------------------------------------------
// Users — admin management (super_admin only)
// ---------------------------------------------------------------------------

export interface CreateAdminPayload {
  username: string;
  email: string;
  password: string;
  allowed_category_ids: number[];
  is_active?: boolean;
}

// ---------------------------------------------------------------------------
// Settings (exchange rate)
// ---------------------------------------------------------------------------

import type { ApiPublicSettings, ApiStock } from "./api-types";

export const settingsApi = {
  getPublic: () => apiFetch<ApiPublicSettings>("/settings/public"),
  updateExchangeRate: (rate: number) =>
    apiFetch<ApiPublicSettings>("/settings/exchange-rate", {
      method: "PATCH",
      body: { rate: String(rate) },
      auth: true,
    }),
};

// ---------------------------------------------------------------------------
// Stocks (admin supplier orders)
// ---------------------------------------------------------------------------

export interface CreateStockPayload {
  reference?: string | null;
  order_date: string;
  arrival_date?: string | null;
  total_amount: string;
  shipping_amount: string;
  quantity: number;
  currency?: string;
  notes?: string | null;
}

export const stockApi = {
  list: () => apiFetch<ApiStock[]>("/stocks/", { auth: true }),
  get: (id: number) => apiFetch<ApiStock>(`/stocks/${id}`, { auth: true }),
  create: (data: CreateStockPayload) =>
    apiFetch<ApiStock>("/stocks/", { method: "POST", body: data, auth: true }),
  update: (id: number, data: Partial<CreateStockPayload>) =>
    apiFetch<ApiStock>(`/stocks/${id}`, { method: "PATCH", body: data, auth: true }),
  remove: (id: number) =>
    apiFetch<void>(`/stocks/${id}`, { method: "DELETE", auth: true }),
};

export const userApi = {
  listAdmins: () => apiFetch<ApiUser[]>("/users/admins", { auth: true }),
  createAdmin: (data: CreateAdminPayload) =>
    apiFetch<ApiUser>("/users/admins", { method: "POST", body: data, auth: true }),
  updateAllowedCategories: (userId: number, categoryIds: number[]) =>
    apiFetch<ApiUser>(`/users/${userId}/allowed-categories`, {
      method: "PATCH",
      body: { allowed_category_ids: categoryIds },
      auth: true,
    }),
  setStatus: (userId: number, isActive: boolean) =>
    apiFetch<ApiUser>(`/users/${userId}/status`, {
      method: "PATCH",
      body: { is_active: isActive },
      auth: true,
    }),
  remove: (userId: number) =>
    apiFetch<void>(`/users/${userId}`, { method: "DELETE", auth: true }),
};

// ---------------------------------------------------------------------------
// Media uploads (admin)
// ---------------------------------------------------------------------------

export const mediaApi = {
  async upload(file: File): Promise<{ filename: string; url: string }> {
    const fd = new FormData();
    fd.append("file", file);
    const token = tokenStorage.get();
    const headers: Record<string, string> = { Accept: "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/media/upload`, {
      method: "POST",
      headers,
      body: fd,
    });
    const text = await res.text();
    let data: any;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      const msg = (data && typeof data === "object" && (data.detail || data.message)) || res.statusText;
      throw new ApiError(res.status, String(msg), data);
    }
    return data;
  },
};

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export const categoryApi = {
  list: (section?: string) =>
    apiFetch<ApiCategory[]>(`/categories/${section ? `?section=${section}` : ""}`),
  get: (id: number) => apiFetch<ApiCategory>(`/categories/${id}`),
  create: (data: Partial<ApiCategory>) =>
    apiFetch<ApiCategory>("/categories/", { method: "POST", body: data, auth: true }),
  update: (id: number, data: Partial<ApiCategory>) =>
    apiFetch<ApiCategory>(`/categories/${id}`, { method: "PATCH", body: data, auth: true }),
  remove: (id: number) =>
    apiFetch<void>(`/categories/${id}`, { method: "DELETE", auth: true }),
};

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export interface ProductListParams {
  section?: string;
  category_id?: number;
  status?: ProductStatus;
  active_only?: boolean;
  /** When true, send the JWT so the backend can scope the list to the
   *  caller's products (admin sees only their own). Default false =
   *  public storefront. */
  authed?: boolean;
}

export const productApi = {
  list: (params: ProductListParams = {}) => {
    const qs = new URLSearchParams();
    if (params.section) qs.set("section", params.section);
    if (params.category_id != null) qs.set("category_id", String(params.category_id));
    if (params.status) qs.set("status", params.status);
    if (params.active_only != null) qs.set("active_only", String(params.active_only));
    const q = qs.toString();
    return apiFetch<ApiProduct[]>(
      `/products/${q ? `?${q}` : ""}`,
      { auth: !!params.authed },
    );
  },
  get: (id: number) => apiFetch<ApiProduct>(`/products/${id}`, { auth: true }),
  getBySlug: (slug: string) => apiFetch<ApiProduct>(`/products/slug/${slug}`),
  create: (data: any) =>
    apiFetch<ApiProduct>("/products/", { method: "POST", body: data, auth: true }),
  update: (id: number, data: any) =>
    apiFetch<ApiProduct>(`/products/${id}`, { method: "PATCH", body: data, auth: true }),
  remove: (id: number) =>
    apiFetch<void>(`/products/${id}`, { method: "DELETE", auth: true }),
};

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export interface CreateOrderItem {
  product_id: number;
  product_size_id?: number | null;
  product_color_id?: number | null;
  quantity: number;
}

export interface CreateOrderPayload {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  customer_city: string;
  notes?: string;
  delivery_requested?: boolean;
  items: CreateOrderItem[];
}

export const orderApi = {
  create: (data: CreateOrderPayload) =>
    apiFetch<ApiOrder>("/orders/", { method: "POST", body: data }),
  list: (status?: OrderStatus) =>
    apiFetch<ApiOrder[]>(`/orders/${status ? `?status=${status}` : ""}`, { auth: true }),
  get: (id: number) => apiFetch<ApiOrder>(`/orders/${id}`, { auth: true }),
  getByNumber: (orderNumber: string) =>
    apiFetch<ApiOrder>(`/orders/by-number/${encodeURIComponent(orderNumber)}`),
  setStatus: (id: number, status: OrderStatus) =>
    apiFetch<ApiOrder>(`/orders/${id}/status`, {
      method: "PATCH",
      body: { status },
      auth: true,
    }),
  remove: (id: number) =>
    apiFetch<void>(`/orders/${id}`, { method: "DELETE", auth: true }),
  initiateMonCash: (orderId: number) =>
    apiFetch<ApiPaymentInitiate>(`/orders/${orderId}/pay/moncash`, { method: "POST" }),
  verifyMonCash: (orderId: number, transactionId: string) =>
    apiFetch<ApiOrder>(`/orders/${orderId}/pay/moncash/verify`, {
      method: "POST",
      body: { transaction_id: transactionId },
    }),
  /**
   * Resolve & verify a MonCash payment from a transactionId alone.
   * The backend asks MonCash which order the transaction belongs to,
   * so the customer-facing return URL doesn't need to carry the order id.
   */
  resolveMonCash: (transactionId: string) =>
    apiFetch<ApiOrder>(`/orders/pay/moncash/resolve`, {
      method: "POST",
      body: { transaction_id: transactionId },
    }),
};
