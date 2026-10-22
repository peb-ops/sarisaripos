import type { PaymentType, Product, Sale } from '../db/schema';
import { isLowStock } from './inventory';
import { lineTotal } from './sales';

export type Range = 'today' | '7d' | '30d';

export const RANGE_DAYS: Record<Range, number> = { today: 1, '7d': 7, '30d': 30 };

function startOfDay(ts: number): Date {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Local midnight at the start of the range (today counts as day 1). */
export function rangeStart(range: Range, now = Date.now()): number {
  const d = startOfDay(now);
  d.setDate(d.getDate() - (RANGE_DAYS[range] - 1));
  return d.getTime();
}

/** Local-time "YYYY-MM-DD". */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function activeSales(sales: Sale[]): Sale[] {
  return sales.filter((s) => !s.voidedAt);
}

export function saleCost(sale: Sale): number {
  return sale.items.reduce((sum, i) => sum + i.cost * i.qty, 0);
}

export interface Summary {
  count: number;
  revenue: number;
  cost: number;
  profit: number;
  byPayment: Record<PaymentType, number>;
}

/** Totals over non-voided sales. */
export function summarize(sales: Sale[]): Summary {
  const out: Summary = { count: 0, revenue: 0, cost: 0, profit: 0, byPayment: { cash: 0, gcash: 0, utang: 0 } };
  for (const s of activeSales(sales)) {
    const cost = saleCost(s);
    out.count += 1;
    out.revenue += s.total;
    out.cost += cost;
    out.byPayment[s.payment] += s.total;
  }
  out.profit = out.revenue - out.cost;
  return out;
}

export interface DayPoint {
  key: string;
  label: string;
  revenue: number;
  profit: number;
}

/** One point per day from start through now, including days with no sales. */
export function dailySeries(sales: Sale[], start: number, now = Date.now()): DayPoint[] {
  const points = new Map<string, DayPoint>();
  const d = startOfDay(start);
  const end = startOfDay(now).getTime();
  while (d.getTime() <= end) {
    const key = dayKey(d.getTime());
    const label = d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
    points.set(key, { key, label, revenue: 0, profit: 0 });
    d.setDate(d.getDate() + 1);
  }
  for (const s of activeSales(sales)) {
    const p = points.get(dayKey(s.createdAt));
    if (!p) continue;
    p.revenue += s.total;
    p.profit += s.total - saleCost(s);
  }
  return [...points.values()];
}

export interface BestSeller {
  productId: number;
  name: string;
  revenue: number;
  profit: number;
  qtyBase: number;
}

export function bestSellers(sales: Sale[], limit = 10): BestSeller[] {
  const byProduct = new Map<number, BestSeller>();
  for (const s of activeSales(sales)) {
    for (const i of s.items) {
      const row = byProduct.get(i.productId) ?? { productId: i.productId, name: i.name, revenue: 0, profit: 0, qtyBase: 0 };
      row.revenue += lineTotal(i);
      row.profit += lineTotal(i) - i.cost * i.qty;
      row.qtyBase += i.qtyInBase * i.qty;
      byProduct.set(i.productId, row);
    }
  }
  return [...byProduct.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}

export function lowStock(products: Product[]): Product[] {
  return products.filter((p) => p.active && isLowStock(p)).sort((a, b) => a.stock - b.stock);
}
