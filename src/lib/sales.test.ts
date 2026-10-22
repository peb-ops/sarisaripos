import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/schema';
import { addCigarettes, resetDb } from '../test/helpers';
import { getBalance, saveCustomer } from './ledger';
import { checkout, voidSale } from './sales';

beforeEach(resetDb);

describe('checkout (cash)', () => {
  it('records the sale, computes change and deducts stock in base units', async () => {
    const id = await addCigarettes(100);
    const sale = await checkout({
      lines: [
        { productId: id, unitIndex: 1, qty: 1 }, // 1 pack = 20 sticks
        { productId: id, unitIndex: 0, qty: 3 }, // 3 sticks
      ],
      payment: 'cash',
      cashReceived: 50000,
    });

    expect(sale.total).toBe(18000 + 3000);
    expect(sale.change).toBe(50000 - 21000);
    expect(sale.items[1].cost).toBe(825);
    expect(sale.items[0].cost).toBe(16500);
    expect((await db.products.get(id))!.stock).toBe(77);

    const moves = await db.stockMoves.where('productId').equals(id).toArray();
    expect(moves.filter((m) => m.reason === 'sale').map((m) => m.delta)).toEqual([-23]);
  });

  it('rejects insufficient cash and saves nothing', async () => {
    const id = await addCigarettes(100);
    await expect(
      checkout({ lines: [{ productId: id, unitIndex: 1, qty: 1 }], payment: 'cash', cashReceived: 10000 }),
    ).rejects.toThrow('less than the total');
    expect(await db.sales.count()).toBe(0);
    expect((await db.products.get(id))!.stock).toBe(100);
  });

  it('allows selling past recorded stock (goes negative)', async () => {
    const id = await addCigarettes(5);
    await checkout({ lines: [{ productId: id, unitIndex: 0, qty: 8 }], payment: 'gcash' });
    expect((await db.products.get(id))!.stock).toBe(-3);
  });

  it('rejects an empty cart and bad quantities', async () => {
    const id = await addCigarettes();
    await expect(checkout({ lines: [], payment: 'gcash' })).rejects.toThrow('empty');
    await expect(checkout({ lines: [{ productId: id, unitIndex: 0, qty: 0 }], payment: 'gcash' })).rejects.toThrow();
    await expect(checkout({ lines: [{ productId: id, unitIndex: 5, qty: 1 }], payment: 'gcash' })).rejects.toThrow();
  });
});

describe('checkout (utang)', () => {
  it('charges the customer', async () => {
    const id = await addCigarettes();
    const nena = await saveCustomer({ name: 'Aling Nena' });
    const sale = await checkout({ lines: [{ productId: id, unitIndex: 0, qty: 4 }], payment: 'utang', customerId: nena });
    expect(sale.customerId).toBe(nena);
    expect(await getBalance(nena)).toBe(4000);
  });

  it('requires a customer', async () => {
    const id = await addCigarettes();
    await expect(checkout({ lines: [{ productId: id, unitIndex: 0, qty: 1 }], payment: 'utang' })).rejects.toThrow();
    expect(await db.sales.count()).toBe(0);
  });
});

describe('voidSale', () => {
  it('restores stock and cancels the utang charge', async () => {
    const id = await addCigarettes(100);
    const nena = await saveCustomer({ name: 'Aling Nena' });
    const sale = await checkout({ lines: [{ productId: id, unitIndex: 1, qty: 2 }], payment: 'utang', customerId: nena });
    expect((await db.products.get(id))!.stock).toBe(60);

    await voidSale(sale.id!);

    expect((await db.products.get(id))!.stock).toBe(100);
    expect(await getBalance(nena)).toBe(0);
    expect((await db.sales.get(sale.id!))!.voidedAt).toBeDefined();
    await expect(voidSale(sale.id!)).rejects.toThrow('already voided');
  });
});
