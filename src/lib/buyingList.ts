import type { Product } from '../db/schema';
import { lowStock } from './reports';

export interface BuyItem {
  product: Product;
  /** Suggested amount to buy, in base units. */
  qtyBase: number;
  /** The same amount in the product's biggest selling unit, e.g. "2 pack". */
  inBiggestUnit?: string;
  /** Estimated cost at the last price paid. */
  cost: number;
}

export interface BuyGroup {
  supplier: string;
  items: BuyItem[];
  cost: number;
}

export const NO_SUPPLIER = 'No supplier set';

/** Enough to bring stock back to twice the low-stock level. */
export function suggestedQty(p: Pick<Product, 'stock' | 'lowStockAt'>): number {
  const target = Math.max(p.lowStockAt * 2, p.lowStockAt + 1);
  return Math.max(1, target - p.stock);
}

export function toBuyItem(p: Product): BuyItem {
  const qtyBase = suggestedQty(p);
  const biggest = [...p.units].sort((a, b) => b.qtyInBase - a.qtyInBase)[0];
  return {
    product: p,
    qtyBase,
    inBiggestUnit: biggest && biggest.qtyInBase > 1 ? `${Math.ceil(qtyBase / biggest.qtyInBase)} ${biggest.name}` : undefined,
    cost: Math.round(qtyBase * p.costPerBase),
  };
}

/** Low-stock products grouped by supplier (named suppliers first, A–Z). */
export function buyingList(products: Product[]): BuyGroup[] {
  const groups = new Map<string, BuyGroup>();
  for (const p of lowStock(products)) {
    const supplier = p.supplier || NO_SUPPLIER;
    const group = groups.get(supplier) ?? { supplier, items: [], cost: 0 };
    const item = toBuyItem(p);
    group.items.push(item);
    group.cost += item.cost;
    groups.set(supplier, group);
  }
  for (const g of groups.values()) g.items.sort((a, b) => a.product.name.localeCompare(b.product.name));
  return [...groups.values()].sort(
    (a, b) => Number(a.supplier === NO_SUPPLIER) - Number(b.supplier === NO_SUPPLIER) || a.supplier.localeCompare(b.supplier),
  );
}
