import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Product } from "@/lib/api-types";

export interface CartItem {
  product: Product;
  qty: number;
  selectedSizeId?: number;
  selectedSizeLabel?: string;
}

const STORAGE_KEY = "maison_cart_v2";

const itemKey = (item: CartItem) =>
  item.selectedSizeId != null
    ? `${item.product.id}#${item.selectedSizeId}`
    : item.product.id;

interface CartCtx {
  items: CartItem[];
  open: boolean;
  setOpen: (v: boolean) => void;
  add: (product: Product, qty?: number, sizeId?: number, sizeLabel?: string) => void;
  remove: (key: string) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
  count: number;
  total: number;
  keyOf: (item: CartItem) => string;
}

const Ctx = createContext<CartCtx | null>(null);

function loadInitial(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => loadInitial());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore quota / privacy errors */
    }
  }, [items]);

  const add = useCallback(
    (product: Product, qty = 1, sizeId?: number, sizeLabel?: string) => {
      setItems((prev) => {
        const newItem: CartItem = {
          product,
          qty,
          selectedSizeId: sizeId,
          selectedSizeLabel: sizeLabel,
        };
        const key = itemKey(newItem);
        const existing = prev.find((i) => itemKey(i) === key);
        if (existing) {
          return prev.map((i) =>
            itemKey(i) === key ? { ...i, qty: i.qty + qty } : i,
          );
        }
        return [...prev, newItem];
      });
      setOpen(true);
    },
    [],
  );

  const remove = useCallback((key: string) => {
    setItems((prev) => prev.filter((i) => itemKey(i) !== key));
  }, []);

  const setQty = useCallback((key: string, qty: number) => {
    setItems((prev) => {
      if (qty <= 0) return prev.filter((i) => itemKey(i) !== key);
      return prev.map((i) => (itemKey(i) === key ? { ...i, qty } : i));
    });
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const { count, total } = useMemo(
    () => ({
      count: items.reduce((s, i) => s + i.qty, 0),
      total: items.reduce((s, i) => s + i.qty * i.product.price, 0),
    }),
    [items],
  );

  const value: CartCtx = {
    items,
    open,
    setOpen,
    add,
    remove,
    setQty,
    clear,
    count,
    total,
    keyOf: itemKey,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
