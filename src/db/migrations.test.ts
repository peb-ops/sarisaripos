import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { SCHEMA_V1, createDb } from './schema';

// Store computers already hold databases made by older app versions. These
// tests build such a database with the old schema, then open it with the
// current code, to prove an update never loses or scrambles records.

const NAME = 'migration-test';

afterEach(() => Dexie.delete(NAME));

async function makeV1Database() {
  const old = new Dexie(NAME);
  old.version(1).stores(SCHEMA_V1);
  await old.table('products').add({
    name: 'Marlboro Red',
    category: 'Cigarettes',
    baseUnit: 'stick',
    stock: 42,
    lowStockAt: 20,
    costPerBase: 825,
    units: [{ name: 'stick', qtyInBase: 1, price: 1000 }],
    active: true,
    createdAt: 1,
  });
  await old.table('customers').add({ name: 'Aling Nena', createdAt: 1 });
  await old.table('sales').add({ createdAt: 5, items: [], total: 1000, payment: 'utang', customerId: 1 });
  await old.table('ledger').add({ customerId: 1, type: 'charge', amount: 1000, saleId: 1, createdAt: 5 });
  await old.table('settings').put({ key: 'storeName', value: 'Tindahan ni Aling Rosa' });
  old.close();
}

describe('database upgrades', () => {
  it('opens a version-1 database with every record intact', async () => {
    await makeV1Database();
    const db = createDb(NAME);
    await db.open();

    expect(db.verno).toBe(2);
    expect((await db.products.toArray()).map((p) => [p.name, p.stock])).toEqual([['Marlboro Red', 42]]);
    expect(await db.customers.count()).toBe(1);
    expect(await db.sales.where('customerId').equals(1).count()).toBe(1);
    expect(await db.ledger.where('saleId').equals(1).count()).toBe(1);
    expect((await db.settings.get('storeName'))?.value).toBe('Tindahan ni Aling Rosa');
    db.close();
  });

  it('adds the new tables, ready to use', async () => {
    await makeV1Database();
    const db = createDb(NAME);
    await db.services.add({ createdAt: 9, kind: 'eload', amount: 5000, fee: 200, payment: 'cash' });
    await db.walletMoves.add({ wallet: 'load', delta: -5000, reason: 'service', serviceId: 1, createdAt: 9 });
    expect(await db.walletMoves.where('wallet').equals('load').count()).toBe(1);
    // Ids keep counting from where version 1 left off.
    expect(await db.products.add({ ...(await db.products.get(1))!, id: undefined })).toBe(2);
    db.close();
  });
});
