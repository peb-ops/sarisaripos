import { db, type PaymentType, type Sale, type SaleItem } from '../db/schema';

export class SaleError extends Error {}

export interface CartLine {
  productId: number;
  unitIndex: number;
  qty: number;
}

export interface CheckoutInput {
  lines: CartLine[];
  payment: PaymentType;
  /** Required for cash. */
  cashReceived?: number;
  /** Required for utang. */
  customerId?: number;
  now?: number;
}

export function lineTotal(item: Pick<SaleItem, 'price' | 'qty'>): number {
  return item.price * item.qty;
}

/**
 * Records a sale, deducts stock and (for utang) charges the customer,
 * all in one transaction: either everything is saved or nothing is.
 * Selling more than the recorded stock is allowed (stock goes negative);
 * the UI warns instead of blocking, since counts in a small store drift.
 */
export async function checkout(input: CheckoutInput): Promise<Sale> {
  const { lines, payment, now = Date.now() } = input;
  if (lines.length === 0) throw new SaleError('Cart is empty.');

  return db.transaction('rw', [db.products, db.customers, db.sales, db.ledger, db.stockMoves], async () => {
    const items: SaleItem[] = [];
    const stockDelta = new Map<number, number>();

    for (const line of lines) {
      if (!Number.isInteger(line.qty) || line.qty <= 0) throw new SaleError('Quantities must be whole numbers above 0.');
      const product = await db.products.get(line.productId);
      if (!product) throw new SaleError('A product in the cart no longer exists.');
      const unit = product.units[line.unitIndex];
      if (!unit) throw new SaleError(`"${product.name}" no longer has that selling unit.`);
      items.push({
        productId: product.id!,
        name: product.name,
        unitName: unit.name,
        qtyInBase: unit.qtyInBase,
        qty: line.qty,
        price: unit.price,
        cost: Math.round(product.costPerBase * unit.qtyInBase),
      });
      stockDelta.set(product.id!, (stockDelta.get(product.id!) ?? 0) - unit.qtyInBase * line.qty);
    }

    const total = items.reduce((sum, i) => sum + lineTotal(i), 0);
    const sale: Sale = { createdAt: now, items, total, payment };

    if (payment === 'cash') {
      const received = input.cashReceived;
      if (received === undefined || !Number.isInteger(received)) throw new SaleError('Enter the cash received.');
      if (received < total) throw new SaleError('Cash received is less than the total.');
      sale.cashReceived = received;
      sale.change = received - total;
    } else if (payment === 'utang') {
      if (input.customerId === undefined) throw new SaleError('Choose who is taking this on utang.');
      if (!(await db.customers.get(input.customerId))) throw new SaleError('Customer not found.');
      sale.customerId = input.customerId;
    }

    const saleId = (await db.sales.add(sale)) as number;

    for (const [productId, delta] of stockDelta) {
      const product = (await db.products.get(productId))!;
      await db.products.update(productId, { stock: product.stock + delta });
      await db.stockMoves.add({ productId, delta, reason: 'sale', saleId, createdAt: now });
    }

    if (payment === 'utang') {
      await db.ledger.add({ customerId: sale.customerId!, type: 'charge', amount: total, saleId, createdAt: now });
    }

    return { ...sale, id: saleId };
  });
}

/** Cancels a sale: puts the stock back and cancels any utang it created. */
export async function voidSale(saleId: number, now = Date.now()): Promise<void> {
  await db.transaction('rw', [db.products, db.sales, db.ledger, db.stockMoves], async () => {
    const sale = await db.sales.get(saleId);
    if (!sale) throw new SaleError('Sale not found.');
    if (sale.voidedAt) throw new SaleError('This sale is already voided.');

    await db.sales.update(saleId, { voidedAt: now });

    const restore = new Map<number, number>();
    for (const item of sale.items) {
      restore.set(item.productId, (restore.get(item.productId) ?? 0) + item.qtyInBase * item.qty);
    }
    for (const [productId, delta] of restore) {
      const product = await db.products.get(productId);
      if (!product) continue; // product was deleted; nothing to restore
      await db.products.update(productId, { stock: product.stock + delta });
      await db.stockMoves.add({ productId, delta, reason: 'void', saleId, createdAt: now });
    }

    if (sale.payment === 'utang' && sale.customerId !== undefined) {
      await db.ledger.add({
        customerId: sale.customerId,
        type: 'void',
        amount: sale.total,
        saleId,
        note: `Voided sale #${saleId}`,
        createdAt: now,
      });
    }
  });
}
