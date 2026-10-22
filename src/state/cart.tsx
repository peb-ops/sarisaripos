import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { CartLine } from '../lib/sales';

// The cart lives above the routes so it survives switching to another
// screen mid-sale (e.g. to add a product that's missing).

interface CartApi {
  items: CartLine[];
  add: (productId: number, unitIndex: number, qty?: number) => void;
  setQty: (index: number, qty: number) => void;
  remove: (index: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartApi | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([]);

  const api = useMemo<CartApi>(
    () => ({
      items,
      add: (productId, unitIndex, qty = 1) =>
        setItems((cur) => {
          const i = cur.findIndex((l) => l.productId === productId && l.unitIndex === unitIndex);
          if (i === -1) return [...cur, { productId, unitIndex, qty }];
          return cur.map((l, j) => (j === i ? { ...l, qty: l.qty + qty } : l));
        }),
      setQty: (index, qty) =>
        setItems((cur) => (qty <= 0 ? cur.filter((_, j) => j !== index) : cur.map((l, j) => (j === index ? { ...l, qty } : l)))),
      remove: (index) => setItems((cur) => cur.filter((_, j) => j !== index)),
      clear: () => setItems([]),
    }),
    [items],
  );

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}

export function useCart(): CartApi {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
