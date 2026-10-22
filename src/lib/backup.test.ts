import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/schema';
import { addCigarettes, resetDb } from '../test/helpers';
import { exportBackup, parseBackup, restoreBackup } from './backup';
import { saveCustomer } from './ledger';
import { checkout } from './sales';

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
  });
});
