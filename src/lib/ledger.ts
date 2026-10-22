import { db, type Customer, type LedgerEntry } from '../db/schema';

export class LedgerError extends Error {}

export function signedAmount(entry: Pick<LedgerEntry, 'type' | 'amount'>): number {
  return entry.type === 'charge' ? entry.amount : -entry.amount;
}

export function balanceOf(entries: Pick<LedgerEntry, 'type' | 'amount'>[]): number {
  return entries.reduce((sum, e) => sum + signedAmount(e), 0);
}

export async function getBalance(customerId: number): Promise<number> {
  return balanceOf(await db.ledger.where('customerId').equals(customerId).toArray());
}

/** Balance per customer id (customers with no entries are absent → 0). */
export async function getAllBalances(): Promise<Map<number, number>> {
  const balances = new Map<number, number>();
  await db.ledger.each((e) => balances.set(e.customerId, (balances.get(e.customerId) ?? 0) + signedAmount(e)));
  return balances;
}

export async function recordPayment(customerId: number, amount: number, note?: string, now = Date.now()) {
  if (!Number.isInteger(amount) || amount <= 0) throw new LedgerError('Enter an amount above ₱0.');
  await db.transaction('rw', db.customers, db.ledger, async () => {
    if (!(await db.customers.get(customerId))) throw new LedgerError('Customer not found.');
    const balance = await getBalance(customerId);
    if (amount > balance) throw new LedgerError('Payment is more than what is owed.');
    await db.ledger.add({ customerId, type: 'payment', amount, note, createdAt: now });
  });
}

export interface CustomerInput {
  name: string;
  phone?: string;
  note?: string;
  creditLimit?: number;
}

export async function saveCustomer(input: CustomerInput, id?: number, now = Date.now()): Promise<number> {
  const name = input.name.trim();
  if (!name) throw new LedgerError('Name is required.');
  if (input.creditLimit !== undefined && (!Number.isInteger(input.creditLimit) || input.creditLimit < 0))
    throw new LedgerError('Credit limit is invalid.');
  const data: Omit<Customer, 'id' | 'createdAt'> = {
    name,
    phone: input.phone?.trim() || undefined,
    note: input.note?.trim() || undefined,
    creditLimit: input.creditLimit,
  };
  if (id !== undefined) {
    const existing = await db.customers.get(id);
    if (!existing) throw new LedgerError('Customer not found.');
    await db.customers.put({ ...existing, ...data, id });
    return id;
  }
  return (await db.customers.add({ ...data, createdAt: now })) as number;
}
