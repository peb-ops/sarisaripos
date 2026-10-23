import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/schema';
import { addCigarettes, resetDb } from '../test/helpers';
import { getBalance, saveCustomer } from './ledger';
import { checkout, voidSale } from './sales';
import {
  DEFAULT_FEES,
  cashEffect,
  defaultFee,
  recordService,
  setWalletBalance,
  summarizeServices,
  topUpWallet,
  voidService,
  walletBalances,
} from './services';

beforeEach(resetDb);

describe('services', () => {
  it('moves each wallet the right way and records what the customer pays', async () => {
    await topUpWallet('load', 100000);
    await topUpWallet('gcash', 500000);

    const load = await recordService({ kind: 'eload', amount: 5000, fee: 200, details: '0917 123 4567' });
    const cashin = await recordService({ kind: 'cashin', amount: 100000, fee: 2000 });
    const cashout = await recordService({ kind: 'cashout', amount: 50000, fee: 1000 });
    const bills = await recordService({ kind: 'bills', amount: 120000, fee: 1500, details: 'Meralco 1234' });

    expect(await walletBalances()).toEqual({ load: 95000, gcash: 500000 - 100000 + 50000 - 120000 });
    expect(cashEffect(load)).toBe(5200); // collect ₱52
    expect(cashEffect(cashin)).toBe(102000);
    expect(cashEffect(cashout)).toBe(-49000); // give ₱490
    expect(cashEffect(bills)).toBe(121500);
  });

  it('puts e-load on utang and voiding takes it off again', async () => {
    const nena = await saveCustomer({ name: 'Aling Nena' });
    const s = await recordService({ kind: 'eload', amount: 2000, fee: 200, payment: 'utang', customerId: nena });
    expect(await getBalance(nena)).toBe(2200);
    expect((await db.ledger.toArray())[0].note).toBe('E-load ₱20.00');

    await voidService(s.id!);
    expect(await getBalance(nena)).toBe(0);
    expect(await walletBalances()).toEqual({ load: 0, gcash: 0 });
    expect((await db.services.get(s.id!))!.voidedAt).toBeDefined();
    await expect(voidService(s.id!)).rejects.toThrow('already voided');
  });

  it('rejects bad input', async () => {
    await expect(recordService({ kind: 'cashin', amount: 0, fee: 0 })).rejects.toThrow('above ₱0');
    await expect(recordService({ kind: 'cashout', amount: 1000, fee: 1000 })).rejects.toThrow('less than');
    await expect(recordService({ kind: 'cashin', amount: 1000, fee: 0, payment: 'utang', customerId: 1 })).rejects.toThrow(
      'Only e-load',
    );
    await expect(recordService({ kind: 'eload', amount: 1000, fee: 0, payment: 'utang' })).rejects.toThrow('Choose who');
    expect(await db.services.count()).toBe(0);
  });

  it('suggests fees: GCash per ₱500 or part of it', () => {
    expect(defaultFee('cashin', 50000, DEFAULT_FEES)).toBe(1000);
    expect(defaultFee('cashin', 50100, DEFAULT_FEES)).toBe(2000);
    expect(defaultFee('cashout', 0, DEFAULT_FEES)).toBe(0);
    expect(defaultFee('eload', 5000, DEFAULT_FEES)).toBe(200);
    expect(defaultFee('bills', 999900, DEFAULT_FEES)).toBe(1500);
  });

  it('corrects a wallet to the balance shown in the app', async () => {
    await topUpWallet('gcash', 10000);
    await recordService({ kind: 'cashin', amount: 3000, fee: 1000 });
    await setWalletBalance('gcash', 6500);
    expect((await walletBalances()).gcash).toBe(6500);
    expect((await db.walletMoves.toArray()).at(-1)).toMatchObject({ reason: 'adjust', delta: -500 });
  });

  it('counts product sales paid by GCash in the GCash wallet', async () => {
    const cig = await addCigarettes(100);
    const sale = await checkout({ lines: [{ productId: cig, unitIndex: 1, qty: 1 }], payment: 'gcash' });
    await checkout({ lines: [{ productId: cig, unitIndex: 0, qty: 1 }], payment: 'cash', cashReceived: 1000 });
    expect((await walletBalances()).gcash).toBe(18000);
    await voidSale(sale.id!);
    expect((await walletBalances()).gcash).toBe(0);
  });

  it('summarizes income without voided services', async () => {
    await recordService({ kind: 'eload', amount: 5000, fee: 200 });
    await recordService({ kind: 'cashin', amount: 50000, fee: 1000 });
    const v = await recordService({ kind: 'bills', amount: 10000, fee: 1500 });
    await voidService(v.id!);
    const sum = summarizeServices(await db.services.toArray());
    expect(sum.count).toBe(2);
    expect(sum.income).toBe(1200);
    expect(sum.byKind.cashin).toEqual({ count: 1, amount: 50000, fee: 1000 });
  });
});
