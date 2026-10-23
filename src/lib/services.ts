import { db, type Service, type ServiceKind, type WalletId } from '../db/schema';
import { formatPeso } from './money';
import { getSetting } from './settings';

export class ServiceError extends Error {}

export interface ServiceInfo {
  label: string;
  wallet: WalletId;
  /** Label for the fee field. */
  feeLabel: string;
  /** Label for the details field. */
  detailsLabel: string;
}

export const SERVICES: Record<ServiceKind, ServiceInfo> = {
  eload: { label: 'E-load', wallet: 'load', feeLabel: 'Your markup', detailsLabel: 'Phone number' },
  cashin: { label: 'GCash cash-in', wallet: 'gcash', feeLabel: 'Fee', detailsLabel: 'GCash number' },
  cashout: { label: 'GCash cash-out', wallet: 'gcash', feeLabel: 'Fee', detailsLabel: 'Reference no.' },
  bills: { label: 'Bills payment', wallet: 'gcash', feeLabel: 'Fee', detailsLabel: 'Biller and account no.' },
};

export const WALLET_LABEL: Record<WalletId, string> = { load: 'Load wallet', gcash: 'GCash wallet' };

/**
 * Money the store receives from (+) or hands to (−) the customer.
 * Cash-out: the customer sends GCash and gets it back in cash, minus the fee.
 */
export function cashEffect(s: Pick<Service, 'kind' | 'amount' | 'fee'>): number {
  return s.kind === 'cashout' ? -(s.amount - s.fee) : s.amount + s.fee;
}

/** Change to the wallet: cash-out adds GCash, everything else spends it. */
export function walletEffect(s: Pick<Service, 'kind' | 'amount'>): number {
  return s.kind === 'cashout' ? s.amount : -s.amount;
}

export interface ServiceFees {
  /** Added to the load value, e.g. ₱2: ₱50 load sells for ₱52. */
  eload: number;
  /** GCash cash-in / cash-out fee per ₱500 or part of it. */
  gcashPer500: number;
  bills: number;
}

export const DEFAULT_FEES: ServiceFees = { eload: 200, gcashPer500: 1000, bills: 1500 };

export async function getFees(): Promise<ServiceFees> {
  return { ...DEFAULT_FEES, ...(await getSetting<Partial<ServiceFees>>('serviceFees', {})) };
}

export function defaultFee(kind: ServiceKind, amount: number, fees: ServiceFees): number {
  switch (kind) {
    case 'eload':
      return fees.eload;
    case 'bills':
      return fees.bills;
    default:
      return amount > 0 ? Math.ceil(amount / 50000) * fees.gcashPer500 : 0;
  }
}

export async function walletBalance(wallet: WalletId): Promise<number> {
  let sum = 0;
  await db.walletMoves.where('wallet').equals(wallet).each((m) => (sum += m.delta));
  return sum;
}

export async function walletBalances(): Promise<Record<WalletId, number>> {
  const out: Record<WalletId, number> = { load: 0, gcash: 0 };
  await db.walletMoves.each((m) => (out[m.wallet] += m.delta));
  return out;
}

export interface ServiceInput {
  kind: ServiceKind;
  amount: number;
  fee: number;
  payment?: 'cash' | 'utang';
  customerId?: number;
  details?: string;
  now?: number;
}

export function describeService(s: Pick<Service, 'kind' | 'amount' | 'details'>): string {
  return `${SERVICES[s.kind].label} ${formatPeso(s.amount)}${s.details ? ` · ${s.details}` : ''}`;
}

/**
 * Records a service and its wallet change (and, for e-load on utang, the
 * customer's charge) in one transaction. Like stock, a wallet may go below
 * zero (the UI warns), since the owner may not have entered its balance yet.
 */
export async function recordService(input: ServiceInput): Promise<Service> {
  const { kind, amount, fee, payment = 'cash', now = Date.now() } = input;
  if (!SERVICES[kind]) throw new ServiceError('Unknown service.');
  if (!Number.isInteger(amount) || amount <= 0) throw new ServiceError('Enter an amount above ₱0.');
  if (!Number.isInteger(fee) || fee < 0) throw new ServiceError('The fee is invalid.');
  if (kind === 'cashout' && fee >= amount) throw new ServiceError('The fee must be less than the amount.');
  if (payment === 'utang' && kind !== 'eload') throw new ServiceError('Only e-load can be taken on utang.');

  return db.transaction('rw', [db.services, db.walletMoves, db.customers, db.ledger], async () => {
    const service: Service = { createdAt: now, kind, amount, fee, payment, details: input.details?.trim() || undefined };
    if (payment === 'utang') {
      if (input.customerId === undefined) throw new ServiceError('Choose who is taking this on utang.');
      if (!(await db.customers.get(input.customerId))) throw new ServiceError('Customer not found.');
      service.customerId = input.customerId;
    }
    const serviceId = (await db.services.add(service)) as number;
    await db.walletMoves.add({
      wallet: SERVICES[kind].wallet,
      delta: walletEffect(service),
      reason: 'service',
      serviceId,
      createdAt: now,
    });
    if (payment === 'utang') {
      await db.ledger.add({
        customerId: service.customerId!,
        type: 'charge',
        amount: cashEffect(service),
        serviceId,
        note: describeService(service),
        createdAt: now,
      });
    }
    return { ...service, id: serviceId };
  });
}

/** Cancels a service: reverses the wallet change and any utang it created. */
export async function voidService(serviceId: number, now = Date.now()): Promise<void> {
  await db.transaction('rw', [db.services, db.walletMoves, db.ledger], async () => {
    const service = await db.services.get(serviceId);
    if (!service) throw new ServiceError('Service not found.');
    if (service.voidedAt) throw new ServiceError('This is already voided.');
    await db.services.update(serviceId, { voidedAt: now });
    await db.walletMoves.add({
      wallet: SERVICES[service.kind].wallet,
      delta: -walletEffect(service),
      reason: 'void',
      serviceId,
      createdAt: now,
    });
    if (service.payment === 'utang' && service.customerId !== undefined) {
      await db.ledger.add({
        customerId: service.customerId,
        type: 'void',
        amount: cashEffect(service),
        serviceId,
        note: `Voided ${describeService(service)}`,
        createdAt: now,
      });
    }
  });
}

/** Money put into a wallet (e.g. buying load from the retailer). */
export async function topUpWallet(wallet: WalletId, amount: number, note?: string, now = Date.now()): Promise<void> {
  if (!Number.isInteger(amount) || amount <= 0) throw new ServiceError('Enter an amount above ₱0.');
  await db.walletMoves.add({ wallet, delta: amount, reason: 'topup', note: note?.trim() || undefined, createdAt: now });
}

/** Sets the wallet to the balance shown in the load / GCash app. */
export async function setWalletBalance(wallet: WalletId, balance: number, now = Date.now()): Promise<void> {
  if (!Number.isInteger(balance)) throw new ServiceError('Enter a valid balance.');
  await db.transaction('rw', db.walletMoves, async () => {
    const delta = balance - (await walletBalance(wallet));
    if (delta === 0) return;
    await db.walletMoves.add({ wallet, delta, reason: 'adjust', note: 'Balance corrected', createdAt: now });
  });
}

export interface ServiceSummary {
  count: number;
  /** Markups and fees earned. */
  income: number;
  byKind: Record<ServiceKind, { count: number; amount: number; fee: number }>;
}

export function summarizeServices(services: Service[]): ServiceSummary {
  const zero = () => ({ count: 0, amount: 0, fee: 0 });
  const out: ServiceSummary = { count: 0, income: 0, byKind: { eload: zero(), cashin: zero(), cashout: zero(), bills: zero() } };
  for (const s of services) {
    if (s.voidedAt) continue;
    out.count += 1;
    out.income += s.fee;
    const k = out.byKind[s.kind];
    k.count += 1;
    k.amount += s.amount;
    k.fee += s.fee;
  }
  return out;
}
