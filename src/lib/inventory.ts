import { db, type Product, type SellUnit } from '../db/schema';

export class InventoryError extends Error {}

export interface ProductInput {
  name: string;
  category: string;
  baseUnit: string;
  lowStockAt: number;
  costPerBase: number;
  units: SellUnit[];
  barcode?: string;
  supplier?: string;
  image?: string;
  active: boolean;
}

export function validateProduct(p: ProductInput): string | null {
  if (!p.name.trim()) return 'Product name is required.';
  if (!p.baseUnit.trim()) return 'Base unit is required (e.g. piece, stick, sachet).';
  if (p.units.length === 0) return 'Add at least one way to sell this product.';
  for (const u of p.units) {
    if (!u.name.trim()) return 'Every selling unit needs a name.';
    if (!Number.isInteger(u.qtyInBase) || u.qtyInBase < 1)
      return `"${u.name}" must contain a whole number of ${p.baseUnit} (1 or more).`;
    if (!Number.isInteger(u.price) || u.price < 0) return `"${u.name}" has an invalid price.`;
  }
  const names = p.units.map((u) => u.name.trim().toLowerCase());
  if (new Set(names).size !== names.length) return 'Selling unit names must be different.';
  if (!Number.isFinite(p.costPerBase) || p.costPerBase < 0) return 'Cost is invalid.';
  if (!Number.isInteger(p.lowStockAt) || p.lowStockAt < 0) return 'Low-stock level is invalid.';
  return null;
}

function normalize(p: ProductInput): ProductInput {
  const barcode = p.barcode?.trim();
  const supplier = p.supplier?.trim();
  return {
    ...p,
    name: p.name.trim(),
    category: p.category.trim() || 'Other',
    baseUnit: p.baseUnit.trim(),
    units: p.units.map((u) => ({ ...u, name: u.name.trim() })),
    barcode: barcode ? barcode : undefined,
    supplier: supplier ? supplier : undefined,
  };
}

/** Creates (no id) or updates a product. Stock is only set on create; use restock/adjustStock after. */
export async function saveProduct(
  input: ProductInput,
  id?: number,
  openingStock = 0,
  now = Date.now(),
): Promise<number> {
  const error = validateProduct(input);
  if (error) throw new InventoryError(error);
  const p = normalize(input);

  return db.transaction('rw', db.products, db.stockMoves, async () => {
    if (p.barcode) {
      const clash = await db.products.where('barcode').equals(p.barcode).first();
      if (clash && clash.id !== id) throw new InventoryError(`Barcode already used by "${clash.name}".`);
    }
    if (id !== undefined) {
      const existing = await db.products.get(id);
      if (!existing) throw new InventoryError('Product not found.');
      // put (not update) so a cleared barcode/image is actually removed.
      await db.products.put({ ...existing, ...p, id });
      return id;
    }
    const newId = (await db.products.add({ ...p, stock: openingStock, createdAt: now } as Product)) as number;
    if (openingStock !== 0) {
      await db.stockMoves.add({
        productId: newId,
        delta: openingStock,
        reason: 'adjust',
        note: 'Opening stock',
        createdAt: now,
      });
    }
    return newId;
  });
}

/**
 * Adds stock. If totalCost (centavos paid for the whole batch) is given,
 * the product's cost becomes the latest price paid per base unit.
 */
export async function restock(
  productId: number,
  qtyBase: number,
  totalCost?: number,
  note?: string,
  now = Date.now(),
): Promise<void> {
  if (!Number.isInteger(qtyBase) || qtyBase <= 0) throw new InventoryError('Quantity must be a whole number above 0.');
  if (totalCost !== undefined && (!Number.isInteger(totalCost) || totalCost < 0))
    throw new InventoryError('Amount paid is invalid.');

  await db.transaction('rw', db.products, db.stockMoves, async () => {
    const product = await db.products.get(productId);
    if (!product) throw new InventoryError('Product not found.');
    const changes: Partial<Product> = { stock: product.stock + qtyBase };
    if (totalCost !== undefined) changes.costPerBase = totalCost / qtyBase;
    await db.products.update(productId, changes);
    await db.stockMoves.add({ productId, delta: qtyBase, reason: 'restock', note, createdAt: now });
  });
}

/** Sets stock to an exact counted number (e.g. after a physical count). */
export async function adjustStock(productId: number, newStock: number, note?: string, now = Date.now()) {
  if (!Number.isInteger(newStock)) throw new InventoryError('Stock must be a whole number.');
  await db.transaction('rw', db.products, db.stockMoves, async () => {
    const product = await db.products.get(productId);
    if (!product) throw new InventoryError('Product not found.');
    const delta = newStock - product.stock;
    if (delta === 0) return;
    await db.products.update(productId, { stock: newStock });
    await db.stockMoves.add({ productId, delta, reason: 'adjust', note: note ?? 'Stock count', createdAt: now });
  });
}

export function isLowStock(p: Product): boolean {
  return p.stock <= p.lowStockAt;
}
