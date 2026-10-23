import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/schema';
import { addCigarettes, cigarettes, resetDb } from '../test/helpers';
import { exportBackup, parseBackup, restoreBackup } from './backup';
import { saveCustomer } from './ledger';
import { checkout } from './sales';
import { recordService } from './services';

beforeEach(resetDb);

describe('backup', () => {
  it('round-trips all data through JSON', async () => {
    const id = await addCigarettes(30);
    const c = await saveCustomer({ name: 'Aling Nena' });
    await checkout({ lines: [{ productId: id, unitIndex: 0, qty: 2 }], payment: 'utang', customerId: c });

    const json = JSON.stringify(await exportBackup());
    await resetDb();
    expect(await db.products.count()).toBe(0);

    await restoreBackup(parseBackup(json));
    expect((await db.products.get(id))!.stock).toBe(28);
    expect(await db.sales.count()).toBe(1);
    expect(await db.ledger.count()).toBe(1);
  });

  it('rejects files that are not backups', () => {
    expect(() => parseBackup('not json')).toThrow('valid');
    expect(() => parseBackup('{"app":"other"}')).toThrow('not a Sari-Sari');
    expect(() => parseBackup('{"app":"sari-sari-pos","version":99,"data":{}}')).toThrow('newer version');
  });

  it('restores a version-1 backup made before services existed', async () => {
    await recordService({ kind: 'eload', amount: 5000, fee: 200 });
    const v1 = {
      app: 'sari-sari-pos',
      version: 1,
      exportedAt: 123,
      data: {
        products: [{ ...cigarettes(), id: 1, stock: 7, createdAt: 1 }],
        customers: [],
        sales: [],
        ledger: [],
        stockMoves: [],
        settings: [{ key: 'storeName', value: 'Old store' }],
      },
    };
    await restoreBackup(parseBackup(JSON.stringify(v1)));
    expect((await db.products.get(1))!.stock).toBe(7);
    expect(await db.services.count()).toBe(0);
    expect((await db.settings.get('storeName'))?.value).toBe('Old store');
  });
});
