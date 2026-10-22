import { Banknote, NotebookPen, Smartphone, TriangleAlert, UserPlus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { PaymentType, Sale } from '../db/schema';
import { useBalances, useCustomers } from '../hooks';
import { saveCustomer } from '../lib/ledger';
import { formatPeso, parsePeso } from '../lib/money';
import { checkout, type CartLine } from '../lib/sales';
import { Modal } from './Modal';
import { Button, ErrorText, Input, PesoInput, errorMessage } from './ui';

const PAYMENTS: { id: PaymentType; label: string; icon: typeof Banknote }[] = [
  { id: 'cash', label: 'Cash', icon: Banknote },
  { id: 'gcash', label: 'GCash', icon: Smartphone },
  { id: 'utang', label: 'Utang', icon: NotebookPen },
];

const BILLS = [2000, 5000, 10000, 20000, 50000, 100000];

export function CheckoutDialog({
  lines,
  total,
  onClose,
  onDone,
}: {
  lines: CartLine[];
  total: number;
  onClose: () => void;
  onDone: (sale: Sale) => void;
}) {
  const [payment, setPayment] = useState<PaymentType>('cash');
  const [cash, setCash] = useState('');
  const [customerId, setCustomerId] = useState<number>();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const cashValue = parsePeso(cash);
  const change = cashValue === null ? null : cashValue - total;
  const canConfirm =
    !saving &&
    (payment === 'cash' ? change !== null && change >= 0 : payment === 'utang' ? customerId !== undefined : true);

  async function confirm(e?: FormEvent) {
    e?.preventDefault();
    if (!canConfirm) return;
    setSaving(true);
    setError('');
    try {
      const sale = await checkout({
        lines,
        payment,
        cashReceived: payment === 'cash' ? cashValue! : undefined,
        customerId: payment === 'utang' ? customerId : undefined,
      });
      onDone(sale);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Checkout"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Back to cart</Button>
          <Button variant="success" size="lg" disabled={!canConfirm} onClick={() => confirm()}>
            Complete sale
          </Button>
        </>
      }
    >
      <form onSubmit={confirm} className="space-y-5">
        <div className="rounded-xl bg-stone-100 p-4 text-center">
          <div className="text-sm font-medium text-stone-500">Total</div>
          <div className="text-4xl font-bold">{formatPeso(total)}</div>
        </div>

        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Payment">
          {PAYMENTS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={payment === id}
              onClick={() => setPayment(id)}
              className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 py-3 font-semibold transition-colors ${
                payment === id ? 'border-red-600 bg-red-50 text-red-800' : 'border-stone-200 hover:bg-stone-50'
              }`}
            >
              <Icon size={24} />
              {label}
            </button>
          ))}
        </div>

        {payment === 'cash' && (
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-stone-700">Cash received</span>
              <PesoInput value={cash} onChange={(e) => setCash(e.target.value)} autoFocus className="py-3 text-2xl font-bold" />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setCash(String(total / 100))}>
                Exact
              </Button>
              {BILLS.filter((b) => b > total)
                .slice(0, 4)
                .map((b) => (
                  <Button key={b} size="sm" onClick={() => setCash(String(b / 100))}>
                    {formatPeso(b).replace('.00', '')}
                  </Button>
                ))}
            </div>
            {change !== null && (
              <div
                className={`rounded-xl p-4 text-center ${change >= 0 ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}
              >
                <div className="text-sm font-medium">{change >= 0 ? 'Change (sukli)' : 'Short (kulang)'}</div>
                <div className="text-4xl font-bold">{formatPeso(Math.abs(change))}</div>
              </div>
            )}
          </div>
        )}

        {payment === 'gcash' && (
          <p className="rounded-xl bg-sky-50 p-4 text-sky-900">
            Check on your phone that <strong>{formatPeso(total)}</strong> was received in GCash before completing the sale.
          </p>
        )}

        {payment === 'utang' && <CustomerPicker total={total} selected={customerId} onSelect={setCustomerId} />}

        <ErrorText>{error}</ErrorText>
        {/* Lets Enter in the cash field submit. */}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function CustomerPicker({
  total,
  selected,
  onSelect,
}: {
  total: number;
  selected?: number;
  onSelect: (id: number) => void;
}) {
  const customers = useCustomers() ?? [];
  const balances = useBalances();
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const q = search.trim().toLowerCase();
  const matches = customers.filter((c) => c.name.toLowerCase().includes(q));
  const exact = customers.some((c) => c.name.toLowerCase() === q);
  const chosen = customers.find((c) => c.id === selected);
  const balance = chosen ? balances?.get(chosen.id!) ?? 0 : 0;
  const after = balance + total;
  const overLimit = chosen?.creditLimit !== undefined && after > chosen.creditLimit;

  async function addNew() {
    try {
      onSelect(await saveCustomer({ name: search }));
      setSearch('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-3">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Who is buying on utang? Type a name…"
        autoFocus
      />
      <ul className="max-h-48 divide-y divide-stone-100 overflow-y-auto rounded-xl border border-stone-200">
        {matches.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onSelect(c.id!)}
              className={`flex w-full cursor-pointer items-center justify-between px-3 py-2.5 text-left ${
                c.id === selected ? 'bg-red-50 font-semibold text-red-800' : 'hover:bg-stone-50'
              }`}
            >
              <span>{c.name}</span>
              <span className="text-sm text-stone-500">owes {formatPeso(balances?.get(c.id!) ?? 0)}</span>
            </button>
          </li>
        ))}
        {matches.length === 0 && !q && <li className="px-3 py-3 text-sm text-stone-500">No customers yet. Type a name to add one.</li>}
      </ul>
      {q && !exact && (
        <Button size="sm" onClick={addNew}>
          <UserPlus size={16} /> Add “{search.trim()}” as new customer
        </Button>
      )}
      <ErrorText>{error}</ErrorText>
      {chosen && (
        <div className="rounded-xl bg-stone-100 p-3 text-sm">
          <strong>{chosen.name}</strong> owes {formatPeso(balance)} now → <strong>{formatPeso(after)}</strong> after this sale.
          {overLimit && (
            <div className="mt-2 flex items-center gap-2 font-semibold text-amber-800">
              <TriangleAlert size={16} /> Over their credit limit of {formatPeso(chosen.creditLimit!)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
