"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type CartItem = {
  variantId: number; slug: string; productName: string; variantName: string;
  priceCents: number; image?: string; quantity: number; maxQuantity: number;
};

type CartCtx = {
  items: CartItem[]; count: number; subtotalCents: number; ready: boolean;
  add: (item: CartItem) => void; setQuantity: (variantId: number, q: number) => void;
  remove: (variantId: number) => void; clear: () => void;
};

const Ctx = createContext<CartCtx | null>(null);
const KEY = "moms-cart-v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch { /* storage blocked: cart lives in memory */ }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* ignore */ }
  }, [items, ready]);

  const add = useCallback((item: CartItem) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.variantId === item.variantId);
      if (!existing) return [...prev, { ...item, quantity: Math.min(item.quantity, item.maxQuantity) }];
      return prev.map((i) =>
        i.variantId === item.variantId
          ? { ...i, ...item, quantity: Math.min(i.quantity + item.quantity, item.maxQuantity, 20) }
          : i,
      );
    });
  }, []);
  const setQuantity = useCallback((variantId: number, q: number) => {
    setItems((prev) => prev.map((i) => (i.variantId === variantId ? { ...i, quantity: Math.max(1, Math.min(q, i.maxQuantity, 20)) } : i)));
  }, []);
  const remove = useCallback((variantId: number) => setItems((prev) => prev.filter((i) => i.variantId !== variantId)), []);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(
    () => ({
      items, ready, add, setQuantity, remove, clear,
      count: items.reduce((s, i) => s + i.quantity, 0),
      subtotalCents: items.reduce((s, i) => s + i.quantity * i.priceCents, 0),
    }),
    [items, ready, add, setQuantity, remove, clear],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
