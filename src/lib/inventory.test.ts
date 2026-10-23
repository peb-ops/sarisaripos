import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/schema';
import { addCigarettes, cigarettes, resetDb } from '../test/helpers';
import { adjustStock, averageCost, restock, saveProduct, validateProduct } from './inventory';

beforeEach(resetDb);

describe('inventory', () => {
  it('validates products', () => {
    expect(validateProduct(cigarettes())).toBeNull();
    expect(validateProduct(cigarettes({ name: '' }))).toMatch(/name/);
    expect(validateProduct(cigarettes({ units: [] }))).toMatch(/at least one/);
    expect(validateProduct(cigarettes({ units: [{ name: 'pack', qtyInBase: 0, price: 100 }] }))).toMatch(/whole number/);
    expect(
      validateProduct(
        cigarettes({
          units: [
            { name: 'stick', qtyInBase: 1, price: 1 },
            { name: 'Stick', qtyInBase: 2, price: 2 },
          ],
        }),
      ),
    ).toMatch(/different/);
  });

  it('records opening stock and keeps stock on edit', async () => {
    const id = await addCigarettes(40);
    expect((await db.stockMoves.where('productId').equals(id).first())!.delta).toBe(40);
    await saveProduct(cigarettes({ name: 'Marlboro Lights' }), id);
    const p = (await db.products.get(id))!;
    expect(p.name).toBe('Marlboro Lights');
    expect(p.stock).toBe(40);
  });

  it('enforces unique barcodes and treats blank as none', async () => {
    await addCigarettes(0, { barcode: '4800016644702' });
    await expect(addCigarettes(0, { name: 'Other', barcode: '4800016644702' })).rejects.toThrow('already used');
    const a = await addCigarettes(0, { name: 'A', barcode: '  ' });
    const b = await addCigarettes(0, { name: 'B', barcode: '' });
    expect((await db.products.get(a))!.barcode).toBeUndefined();
    expect((await db.products.get(b))!.barcode).toBeUndefined();
  });

  it('restocks and updates cost per base unit', async () => {
    const id = await addCigarettes(10);
    await restock(id, 40, 33000); // 2 packs for ₱330
    const p = (await db.products.get(id))!;
    expect(p.stock).toBe(50);
    expect(p.costPerBase).toBe(825);
  });

  it('averages the cost of stock on hand with the new batch', async () => {
    const id = await addCigarettes(50, { costPerBase: 800 }); // 50 sticks at ₱8
    await restock(id, 100, 90000); // 100 sticks at ₱9
    expect((await db.products.get(id))!.costPerBase).toBeCloseTo(2600 / 3); // ≈ ₱8.67

    // Cheaper batch pulls the average down.
    await restock(id, 150, 105000); // 150 at ₱7 → (150 × 8.667 + 1050) / 300 ≈ ₱7.83
    expect((await db.products.get(id))!.costPerBase).toBeCloseTo((150 * (2600 / 3) + 105000) / 300);
  });

  it('uses the new price when nothing (or less than nothing) was left', async () => {
    const id = await addCigarettes(-5, { costPerBase: 800 });
    await restock(id, 20, 19000);
    expect((await db.products.get(id))!.costPerBase).toBe(950);
    expect(averageCost(0, 800, 10, 9000)).toBe(900);
  });

  it('adjusts to a counted stock level', async () => {
    const id = await addCigarettes(50);
    await adjustStock(id, 47);
    expect((await db.products.get(id))!.stock).toBe(47);
    const last = await db.stockMoves.where('productId').equals(id).last();
    expect(last!.delta).toBe(-3);
  });
});
