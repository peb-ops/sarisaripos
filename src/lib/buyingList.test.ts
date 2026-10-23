import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/schema';
import { addCigarettes, resetDb } from '../test/helpers';
import { NO_SUPPLIER, buyingList, suggestedQty } from './buyingList';
import { saveProduct } from './inventory';

beforeEach(resetDb);

describe('buying list', () => {
  it('suggests enough to reach twice the low-stock level', () => {
    expect(suggestedQty({ stock: 5, lowStockAt: 20 })).toBe(35);
    expect(suggestedQty({ stock: -3, lowStockAt: 5 })).toBe(13);
    expect(suggestedQty({ stock: 0, lowStockAt: 0 })).toBe(1);
  });

  it('groups low-stock items by supplier with pack counts and cost', async () => {
    await addCigarettes(10, { supplier: 'Puregold' });
    await addCigarettes(100, { name: 'Fortune', supplier: 'Puregold' }); // well stocked
    await saveProduct(
      { name: 'Coke Mismo', category: 'Drinks', baseUnit: 'bottle', lowStockAt: 6, costPerBase: 1500, units: [{ name: 'bottle', qtyInBase: 1, price: 2000 }], active: true },
      undefined,
      2,
    );

    const groups = buyingList(await db.products.toArray());
    expect(groups.map((g) => g.supplier)).toEqual(['Puregold', NO_SUPPLIER]);
    const [marlboro] = groups[0].items;
    expect(marlboro.product.name).toBe('Marlboro Red');
    expect(marlboro.qtyBase).toBe(30);
    expect(marlboro.inBiggestUnit).toBe('2 pack');
    expect(marlboro.cost).toBe(24750); // 30 × ₱8.25
    expect(groups[1].items[0]).toMatchObject({ qtyBase: 10, inBiggestUnit: undefined, cost: 15000 });
  });
});
