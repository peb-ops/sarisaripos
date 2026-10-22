import Dexie, { type EntityTable } from 'dexie';

// All money values are integer centavos (₱1.00 = 100), except
// Product.costPerBase which may be fractional (e.g. ₱163 per 20 sticks).

/** One way a product can be sold, e.g. "stick" (1) or "pack" (20 sticks). */
export interface SellUnit {
  name: string;
  /** How many base units this sell unit takes from stock. */
  qtyInBase: number;
  price: number;
}

export interface Product {
  id?: number;
  name: string;
  category: string;
  /** Smallest unit stock is counted in, e.g. "stick", "piece", "¼ kg". */
  baseUnit: string;
  /** Current stock in base units. Can go negative if sold before restocking. */
  stock: number;
  lowStockAt: number;
  /** What the owner paid per base unit (latest restock). */
  costPerBase: number;
  units: SellUnit[];
  barcode?: string;
  /** Small JPEG data URL. */
  image?: string;
  active: boolean;
  createdAt: number;
}

export interface Customer {
  id?: number;
  name: string;
  phone?: string;
  note?: string;
  creditLimit?: number;
  createdAt: number;
}

export type PaymentType = 'cash' | 'gcash' | 'utang';

/** Snapshot of what was sold, so later product edits don't rewrite history. */
export interface SaleItem {
  productId: number;
  name: string;
  unitName: string;
  qtyInBase: number;
  qty: number;
  /** Per sell unit. */
  price: number;
  /** Per sell unit, rounded to centavos. */
  cost: number;
}

export interface Sale {
  id?: number;
  createdAt: number;
  items: SaleItem[];
  total: number;
  payment: PaymentType;
  cashReceived?: number;
  change?: number;
  customerId?: number;
  voidedAt?: number;
}

/** charge = customer owes more; payment / void = owes less. */
export type LedgerType = 'charge' | 'payment' | 'void';

export interface LedgerEntry {
  id?: number;
  customerId: number;
  type: LedgerType;
  amount: number;
  saleId?: number;
  note?: string;
  createdAt: number;
}

export type StockReason = 'sale' | 'restock' | 'adjust' | 'void';

export interface StockMove {
  id?: number;
  productId: number;
  delta: number;
  reason: StockReason;
  saleId?: number;
  note?: string;
  createdAt: number;
}

export interface Setting {
  key: string;
  value: unknown;
}

export type PosDB = Dexie & {
  products: EntityTable<Product, 'id'>;
  customers: EntityTable<Customer, 'id'>;
  sales: EntityTable<Sale, 'id'>;
  ledger: EntityTable<LedgerEntry, 'id'>;
  stockMoves: EntityTable<StockMove, 'id'>;
  settings: EntityTable<Setting, 'key'>;
};

export function createDb(name = 'sari-sari-pos'): PosDB {
  const db = new Dexie(name) as PosDB;
  db.version(1).stores({
    products: '++id, name, category, barcode',
    customers: '++id, name',
    sales: '++id, createdAt, customerId',
    ledger: '++id, customerId, createdAt, saleId',
    stockMoves: '++id, productId, createdAt',
    settings: 'key',
  });
  return db;
}

export const db = createDb();
