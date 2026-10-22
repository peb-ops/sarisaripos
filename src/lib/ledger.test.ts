import { beforeEach, describe, expect, it } from 'vitest';
import { addCigarettes, resetDb } from '../test/helpers';
import { getAllBalances, getBalance, recordPayment, saveCustomer } from './ledger';
import { checkout } from './sales';

beforeEach(resetDb);

async function owe(customerId: number, sticks: number) {
  const productId = await addCigarettes(100, { name: `Cig ${Math.random()}` });
  await checkout({ lines: [{ productId, unitIndex: 0, qty: sticks }], payment: 'utang', customerId });
}

describe('utang ledger', () => {
  it('tracks partial payments', async () => {
    const jun = await saveCustomer({ name: 'Mang Jun' });
    await owe(jun, 10); // ₱100
    await recordPayment(jun, 3000);
    expect(await getBalance(jun)).toBe(7000);
    await recordPayment(jun, 7000);
    expect(await getBalance(jun)).toBe(0);
  });

  it('rejects overpayment and non-positive amounts', async () => {
    const jun = await saveCustomer({ name: 'Mang Jun' });
    await owe(jun, 2);
    await expect(recordPayment(jun, 2001)).rejects.toThrow('more than');
    await expect(recordPayment(jun, 0)).rejects.toThrow();
    expect(await getBalance(jun)).toBe(2000);
  });

  it('computes balances for all customers', async () => {
    const a = await saveCustomer({ name: 'A' });
    const b = await saveCustomer({ name: 'B' });
    await owe(a, 1);
    await owe(b, 5);
    await recordPayment(b, 500);
    const balances = await getAllBalances();
    expect(balances.get(a)).toBe(1000);
    expect(balances.get(b)).toBe(4500);
  });

  it('requires a customer name', async () => {
    await expect(saveCustomer({ name: '  ' })).rejects.toThrow('Name');
  });
});
