import { describe, expect, it } from 'vitest';
import type { Sale } from '../db/schema';
import { bestSellers, dailySeries, dayKey, rangeStart, summarize } from './reports';

const NOW = new Date(2026, 9, 22, 15, 0).getTime(); // Oct 22 2026, 3pm local

function sale(over: Partial<Sale> & { daysAgo?: number } = {}): Sale {
  const { daysAgo = 0, ...rest } = over;
  return {
    createdAt: NOW - daysAgo * 86_400_000,
    items: [{ productId: 1, name: 'Coke Mismo', unitName: 'bottle', qtyInBase: 1, qty: 2, price: 2000, cost: 1700 }],
    total: 4000,
    payment: 'cash',
    ...rest,
  };
}

describe('reports', () => {
  it('summarizes revenue, profit and payment types, skipping voided sales', () => {
    const s = summarize([sale(), sale({ payment: 'utang' }), sale({ voidedAt: NOW })]);
    expect(s.count).toBe(2);
    expect(s.revenue).toBe(8000);
    expect(s.cost).toBe(6800);
    expect(s.profit).toBe(1200);
    expect(s.byPayment).toEqual({ cash: 4000, gcash: 0, utang: 4000 });
  });

  it('computes range starts at local midnight', () => {
    expect(new Date(rangeStart('today', NOW)).getHours()).toBe(0);
    expect(dayKey(rangeStart('today', NOW))).toBe('2026-10-22');
    expect(dayKey(rangeStart('7d', NOW))).toBe('2026-10-16');
  });

  it('builds a daily series including empty days', () => {
    const series = dailySeries([sale(), sale({ daysAgo: 2 })], rangeStart('7d', NOW), NOW);
    expect(series).toHaveLength(7);
    expect(series.at(-1)!.revenue).toBe(4000);
    expect(series.at(-3)!.revenue).toBe(4000);
    expect(series[0].revenue).toBe(0);
  });

  it('ranks best sellers by revenue', () => {
    const chips: Sale = sale({
      items: [{ productId: 2, name: 'Piattos', unitName: 'pack', qtyInBase: 1, qty: 5, price: 2000, cost: 1700 }],
      total: 10000,
    });
    const top = bestSellers([sale(), chips]);
    expect(top.map((t) => t.name)).toEqual(['Piattos', 'Coke Mismo']);
    expect(top[0].qtyBase).toBe(5);
    expect(top[0].profit).toBe(1500);
  });
});
