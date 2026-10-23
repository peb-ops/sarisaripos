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
  /** Where the owner buys it (for the buying list). */
  supplier?: string;
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
  /** Set for e-load taken on utang. */
  serviceId?: number;
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

/** Services the store does with its load / GCash wallets instead of stock. */
export type ServiceKind = 'eload' | 'cashin' | 'cashout' | 'bills';
export type WalletId = 'load' | 'gcash';

export interface Service {
  id?: number;
  createdAt: number;
  kind: ServiceKind;
  /** Load value, GCash amount sent or received, or bill amount. */
  amount: number;
  /** What the store earns: the e-load markup or the service fee. */
  fee: number;
  /** Only e-load can be taken on utang. */
  payment: 'cash' | 'utang';
  customerId?: number;
  /** Phone number, biller and account number, or reference number. */
  details?: string;
  voidedAt?: number;
}

/** sale = a product sale paid by GCash. */
export type WalletReason = 'service' | 'sale' | 'topup' | 'adjust' | 'void';

export interface WalletMove {
  id?: number;
  wallet: WalletId;
  delta: number;
  reason: WalletReason;
  serviceId?: number;
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
  services: EntityTable<Service, 'id'>;
  walletMoves: EntityTable<WalletMove, 'id'>;
  settings: EntityTable<Setting, 'key'>;
};

// Database versions. Never edit a version that has shipped: stores already
// on store computers were created with it. To change the schema, add a new
// version below (with an upgrade() if existing rows need changing) and a test
// in migrations.test.ts that opens a database made by the previous version.
export const SCHEMA_V1 = {
  products: '++id, name, category, barcode',
  customers: '++id, name',
  sales: '++id, createdAt, customerId',
  ledger: '++id, customerId, createdAt, saleId',
  stockMoves: '++id, productId, createdAt',
  settings: 'key',
};

/** v2 (app 0.2): load / GCash services and their wallets. */
export const SCHEMA_V2 = {
  services: '++id, createdAt, kind, customerId',
  walletMoves: '++id, wallet, createdAt, serviceId',
};

export function createDb(name = 'sari-sari-pos'): PosDB {
  const db = new Dexie(name) as PosDB;
  db.version(1).stores(SCHEMA_V1);
  db.version(2).stores(SCHEMA_V2);
  return db;
}

export const db = createDb();
