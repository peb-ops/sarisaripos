import { strFromU8, unzipSync } from 'fflate';
import { beforeEach, describe, expect, it } from 'vitest';
import { addCigarettes, resetDb } from '../test/helpers';
import { toCsv } from './csv';
import { collectTables, type Table } from './exportData';
import { recordPayment, saveCustomer } from './ledger';
import { checkout, voidSale } from './sales';
import { recordService, topUpWallet } from './services';
import { toXlsx } from './xlsx';

beforeEach(resetDb);

/** 1 cash sale (3 sticks), 1 utang sale (1 pack) partly paid, 1 voided sale. */
async function seedStore() {
  const cig = await addCigarettes(100);
  const nena = await saveCustomer({ name: 'Aling Nena', creditLimit: 100000 });
  await checkout({ lines: [{ productId: cig, unitIndex: 0, qty: 3 }], payment: 'cash', cashReceived: 5000, now: 1000 });
  await checkout({ lines: [{ productId: cig, unitIndex: 1, qty: 1 }], payment: 'utang', customerId: nena, now: 2000 });
  await recordPayment(nena, 5000, 'partial', 3000);
  const voided = await checkout({ lines: [{ productId: cig, unitIndex: 0, qty: 1 }], payment: 'gcash', now: 4000 });
  await voidSale(voided.id!, 5000);
}

const col = (t: Table, header: string) => t.columns.findIndex((c) => c.header === header);

describe('export tables', () => {
  it('builds every sheet for "all"', async () => {
    await seedStore();
    const tables = await collectTables('all');
    expect(tables.map((t) => t.name)).toEqual(['Products', 'Sales', 'Sale items', 'Customers', 'Utang history', 'Load & GCash', 'Wallet history']);
  });

  it('converts money to pesos and keeps voided sales marked', async () => {
    await seedStore();
    const [sales, items] = await collectTables('sales');
    expect(sales.rows).toHaveLength(3);
    const [cash, utang, voided] = sales.rows;
    expect(cash[col(sales, 'Total')]).toBe(30);
    expect(cash[col(sales, 'Change')]).toBe(20);
    expect(cash[col(sales, 'Profit')]).toBe(5.25); // 3 × (10 − 8.25)
    expect(utang[col(sales, 'Customer')]).toBe('Aling Nena');
    expect(voided[col(sales, 'Status')]).toBe('Voided');
    expect(items.rows.map((r) => r[col(items, 'Unit')])).toEqual(['stick', 'pack', 'stick']);
  });

  it('limits sales to a date range', async () => {
    await seedStore();
    const [sales] = await collectTables('sales', 2000);
    expect(sales.rows.map((r) => (r[col(sales, 'Date')] as Date).getTime())).toEqual([2000, 4000]);
  });

  it('shows what each customer owes and a running utang balance', async () => {
    await seedStore();
    const [customers, history] = await collectTables('utang');
    expect(customers.rows[0][col(customers, 'Owes')]).toBe(130); // 180 − 50
    expect(history.rows.map((r) => r[col(history, 'Amount')])).toEqual([180, -50]);
    expect(history.rows.map((r) => r[col(history, 'Balance after')])).toEqual([180, 130]);
  });

  it('lists products with their selling units', async () => {
    await addCigarettes(15);
    const [products] = await collectTables('products');
    const row = products.rows[0];
    expect(row[col(products, 'Selling units')]).toBe('stick ₱10.00; pack (20) ₱180.00');
    expect(row[col(products, 'Low stock?')]).toBe('Yes'); // 15 ≤ 20
  });
});

describe('services export', () => {
  it('lists services with cash effect and a running wallet balance', async () => {
    await topUpWallet('gcash', 100000, 'Starting balance', 1000);
    await recordService({ kind: 'cashout', amount: 50000, fee: 1000, now: 2000 });
    await recordService({ kind: 'eload', amount: 5000, fee: 200, now: 3000 });
    const [services, wallet] = await collectTables('services');
    expect(services.rows.map((r) => [r[col(services, 'Service')], r[col(services, 'Cash in (+) / out (−)')]])).toEqual([
      ['GCash cash-out', -490],
      ['E-load', 52],
    ]);
    expect(wallet.rows.map((r) => [r[col(wallet, 'Wallet')], r[col(wallet, 'Balance after')]])).toEqual([
      ['GCash wallet', 1000],
      ['GCash wallet', 1500],
      ['Load wallet', -50],
    ]);
  });
});

describe('csv', () => {
  const table: Table = {
    name: 'T',
    columns: [
      { header: 'Name', type: 'text' },
      { header: 'Price', type: 'money' },
      { header: 'When', type: 'datetime' },
    ],
    rows: [
      ['Coke, 1.5L "big"', 75, new Date(2026, 9, 22, 15, 5)],
      ['=HYPERLINK("x")', 0.5, null],
      ['Piñata ₱', null, null],
    ],
  };

  it('quotes, guards formulas and starts with a UTF-8 BOM', () => {
    const csv = toCsv(table);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.split('\r\n')).toEqual([
      '﻿Name,Price,When',
      '"Coke, 1.5L ""big""",75.00,2026-10-22 15:05',
      `"'=HYPERLINK(""x"")",0.50,`,
      'Piñata ₱,,',
      '',
    ]);
  });
});

describe('xlsx', () => {
  it('writes a workbook with one sheet per table and peso formatting', async () => {
    await seedStore();
    const blob = await toXlsx(await collectTables('all'));
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    const workbook = strFromU8(files['xl/workbook.xml']);
    for (const name of ['Products', 'Sales', 'Sale items', 'Customers', 'Utang history', 'Load & GCash', 'Wallet history']) {
      expect(workbook).toContain(`name="${name.replace('&', '&amp;')}"`);
    }
    expect(strFromU8(files['xl/styles.xml'])).toContain('&quot;₱&quot;#,##0.00');
  });
});
