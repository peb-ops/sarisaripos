import { db } from '../db/schema';
import { saveProduct, type ProductInput } from '../lib/inventory';

export async function resetDb() {
  await Promise.all(db.tables.map((t) => t.clear()));
}

/** Marlboro: ₱10/stick, ₱180/pack of 20, cost ₱8.25/stick. */
export function cigarettes(overrides: Partial<ProductInput> = {}): ProductInput {
  return {
    name: 'Marlboro Red',
    category: 'Cigarettes',
    baseUnit: 'stick',
    lowStockAt: 20,
    costPerBase: 825,
    units: [
      { name: 'stick', qtyInBase: 1, price: 1000 },
      { name: 'pack', qtyInBase: 20, price: 18000 },
    ],
    active: true,
    ...overrides,
  };
}

export function addCigarettes(stock = 100, overrides: Partial<ProductInput> = {}) {
  return saveProduct(cigarettes(overrides), undefined, stock);
}
