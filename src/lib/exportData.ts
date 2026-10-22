import { db, type Customer, type LedgerEntry, type LedgerType, type PaymentType, type Product, type Sale } from '../db/schema';
import { itemsSummary } from './format';
import { isLowStock } from './inventory';
import { signedAmount } from './ledger';
import { formatPeso } from './money';
import { saleCost } from './reports';
import { lineTotal } from './sales';

// Turns store records into plain tables for CSV / Excel export.
// Money is converted from centavos to pesos (123.45).

export type ColumnType = 'text' | 'money' | 'number' | 'datetime';

export interface Column {
  header: string;
  type: ColumnType;
  width?: number;
}

export type CellValue = string | number | Date | null;

export interface Table {
  /** Sheet name in Excel, file name part for CSV. */
  name: string;
  columns: Column[];
  rows: CellValue[][];
}

const pesos = (centavos: number) => Math.round(centavos) / 100;
const PAYMENT: Record<PaymentType, string> = { cash: 'Cash', gcash: 'GCash', utang: 'Utang' };
const LEDGER_TYPE: Record<LedgerType, string> = { charge: 'Bought on utang', payment: 'Paid', void: 'Sale voided' };

export function productsTable(products: Product[]): Table {
  return {
    name: 'Products',
    columns: [
      { header: 'Name', type: 'text', width: 30 },
      { header: 'Category', type: 'text', width: 16 },
      { header: 'Counted in', type: 'text', width: 11 },
      { header: 'Selling units', type: 'text', width: 34 },
      { header: 'Cost per base unit', type: 'money', width: 12 },
      { header: 'Stock', type: 'number', width: 9 },
      { header: 'Low-stock level', type: 'number', width: 9 },
      { header: 'Low stock?', type: 'text', width: 9 },
      { header: 'Barcode', type: 'text', width: 16 },
      { header: 'Status', type: 'text', width: 10 },
    ],
    rows: [...products]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => [
        p.name,
        p.category,
        p.baseUnit,
        p.units.map((u) => `${u.name}${u.qtyInBase > 1 ? ` (${u.qtyInBase})` : ''} ${formatPeso(u.price)}`).join('; '),
        pesos(p.costPerBase),
        p.stock,
        p.lowStockAt,
        p.active && isLowStock(p) ? 'Yes' : 'No',
        p.barcode ?? null,
        p.active ? 'For sale' : 'Archived',
      ]),
  };
}

export function salesTable(sales: Sale[], customers: Customer[]): Table {
  const names = new Map(customers.map((c) => [c.id!, c.name]));
  return {
    name: 'Sales',
    columns: [
      { header: 'Sale #', type: 'number', width: 8 },
      { header: 'Date', type: 'datetime', width: 17 },
      { header: 'Items', type: 'text', width: 50 },
      { header: 'Payment', type: 'text', width: 9 },
      { header: 'Customer', type: 'text', width: 18 },
      { header: 'Total', type: 'money', width: 11 },
      { header: 'Cost', type: 'money', width: 11 },
      { header: 'Profit', type: 'money', width: 11 },
      { header: 'Cash received', type: 'money', width: 11 },
      { header: 'Change', type: 'money', width: 11 },
      { header: 'Status', type: 'text', width: 9 },
    ],
    rows: [...sales]
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((s) => {
        const cost = saleCost(s);
        return [
          s.id ?? null,
          new Date(s.createdAt),
          itemsSummary(s.items, 50),
          PAYMENT[s.payment],
          s.customerId !== undefined ? names.get(s.customerId) ?? '(deleted customer)' : null,
          pesos(s.total),
          pesos(cost),
          pesos(s.total - cost),
          s.cashReceived !== undefined ? pesos(s.cashReceived) : null,
          s.change !== undefined ? pesos(s.change) : null,
          s.voidedAt ? 'Voided' : 'OK',
        ];
      }),
  };
}

/** One row per item sold, for item-level analysis (pivot tables). */
export function saleItemsTable(sales: Sale[]): Table {
  return {
    name: 'Sale items',
    columns: [
      { header: 'Sale #', type: 'number', width: 8 },
      { header: 'Date', type: 'datetime', width: 17 },
      { header: 'Product', type: 'text', width: 30 },
      { header: 'Unit', type: 'text', width: 10 },
      { header: 'Qty', type: 'number', width: 6 },
      { header: 'Price', type: 'money', width: 10 },
      { header: 'Line total', type: 'money', width: 11 },
      { header: 'Cost', type: 'money', width: 10 },
      { header: 'Profit', type: 'money', width: 10 },
      { header: 'Status', type: 'text', width: 9 },
    ],
    rows: [...sales]
      .sort((a, b) => a.createdAt - b.createdAt)
      .flatMap((s) =>
        s.items.map((i) => [
          s.id ?? null,
          new Date(s.createdAt),
          i.name,
          i.unitName,
          i.qty,
          pesos(i.price),
          pesos(lineTotal(i)),
          pesos(i.cost * i.qty),
          pesos(lineTotal(i) - i.cost * i.qty),
          s.voidedAt ? 'Voided' : 'OK',
        ]),
      ),
  };
}

export function customersTable(customers: Customer[], entries: LedgerEntry[]): Table {
  const owes = new Map<number, number>();
  for (const e of entries) owes.set(e.customerId, (owes.get(e.customerId) ?? 0) + signedAmount(e));
  return {
    name: 'Customers',
    columns: [
      { header: 'Name', type: 'text', width: 24 },
      { header: 'Phone', type: 'text', width: 16 },
      { header: 'Owes', type: 'money', width: 12 },
      { header: 'Credit limit', type: 'money', width: 12 },
      { header: 'Note', type: 'text', width: 30 },
    ],
    rows: [...customers]
      .sort((a, b) => (owes.get(b.id!) ?? 0) - (owes.get(a.id!) ?? 0) || a.name.localeCompare(b.name))
      .map((c) => [
        c.name,
        c.phone ?? null,
        pesos(owes.get(c.id!) ?? 0),
        c.creditLimit !== undefined ? pesos(c.creditLimit) : null,
        c.note ?? null,
      ]),
  };
}

/** Every utang charge/payment with the customer's balance after it. */
export function ledgerTable(entries: LedgerEntry[], customers: Customer[]): Table {
  const names = new Map(customers.map((c) => [c.id!, c.name]));
  const running = new Map<number, number>();
  return {
    name: 'Utang history',
    columns: [
      { header: 'Date', type: 'datetime', width: 17 },
      { header: 'Customer', type: 'text', width: 22 },
      { header: 'What', type: 'text', width: 16 },
      { header: 'Amount', type: 'money', width: 11 },
      { header: 'Balance after', type: 'money', width: 12 },
      { header: 'Sale #', type: 'number', width: 8 },
      { header: 'Note', type: 'text', width: 30 },
    ],
    rows: [...entries]
      .sort((a, b) => a.createdAt - b.createdAt || (a.id ?? 0) - (b.id ?? 0))
      .map((e) => {
        const balance = (running.get(e.customerId) ?? 0) + signedAmount(e);
        running.set(e.customerId, balance);
        return [
          new Date(e.createdAt),
          names.get(e.customerId) ?? '(deleted customer)',
          LEDGER_TYPE[e.type],
          pesos(signedAmount(e)),
          pesos(balance),
          e.saleId ?? null,
          e.note ?? null,
        ];
      }),
  };
}

export type ExportKind = 'products' | 'sales' | 'utang' | 'all';

/** Loads the records for an export. `since` limits sales to a date range. */
export async function collectTables(kind: ExportKind, since?: number): Promise<Table[]> {
  const sales = () =>
    since === undefined ? db.sales.toArray() : db.sales.where('createdAt').aboveOrEqual(since).toArray();

  return db.transaction('r', [db.products, db.sales, db.customers, db.ledger], async () => {
    switch (kind) {
      case 'products':
        return [productsTable(await db.products.toArray())];
      case 'sales': {
        const [s, customers] = await Promise.all([sales(), db.customers.toArray()]);
        return [salesTable(s, customers), saleItemsTable(s)];
      }
      case 'utang': {
        const [customers, entries] = await Promise.all([db.customers.toArray(), db.ledger.toArray()]);
        return [customersTable(customers, entries), ledgerTable(entries, customers)];
      }
      case 'all': {
        const [products, s, customers, entries] = await Promise.all([
          db.products.toArray(),
          sales(),
          db.customers.toArray(),
          db.ledger.toArray(),
        ]);
        return [
          productsTable(products),
          salesTable(s, customers),
          saleItemsTable(s),
          customersTable(customers, entries),
          ledgerTable(entries, customers),
        ];
      }
    }
  });
}
