import { useLiveQuery } from 'dexie-react-hooks';
import { HandCoins, NotebookPen, Pencil, Search, UserPlus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ExportMenu } from '../components/ExportMenu';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { Button, Card, ErrorText, Field, Input, PesoInput, errorMessage } from '../components/ui';
import { db, type Customer, type LedgerType } from '../db/schema';
import { useBalances, useCustomers } from '../hooks';
import { exportCsv, exportExcel } from '../lib/exportFiles';
import { formatDateTime, itemsSummary } from '../lib/format';
import { recordPayment, saveCustomer, signedAmount } from '../lib/ledger';
import { formatPeso, parsePeso, pesoInputValue } from '../lib/money';

export default function Utang() {
  const params = useParams();
  const navigate = useNavigate();
  const customers = useCustomers() ?? [];
  const balances = useBalances() ?? new Map<number, number>();
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const toast = useToast();

  const selectedId = params.customerId ? Number(params.customerId) : undefined;
  const totalOwed = [...balances.values()].reduce((s, b) => s + Math.max(0, b), 0);
  const q = search.trim().toLowerCase();
  const list = customers
    .filter((c) => !q || c.name.toLowerCase().includes(q))
    .sort((a, b) => (balances.get(b.id!) ?? 0) - (balances.get(a.id!) ?? 0) || a.name.localeCompare(b.name));

  return (
    <div className="flex h-full">
      <section className="flex w-80 shrink-0 flex-col border-r border-stone-200 bg-white">
        <div className="space-y-3 border-b border-stone-200 p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Utang</h1>
            <div className="flex gap-2">
              <ExportMenu
                align="left"
                items={[
                  { label: 'Customers & utang (Excel)', format: 'excel', run: () => exportExcel('utang') },
                  { label: 'Who owes what (CSV)', format: 'csv', run: () => exportCsv('utang', { table: 'Customers' }) },
                  { label: 'Utang history (CSV)', format: 'csv', run: () => exportCsv('utang', { table: 'Utang history' }) },
                ]}
              />
              <Button size="sm" variant="primary" onClick={() => setAdding(true)}>
                <UserPlus size={16} /> Add
              </Button>
            </div>
          </div>
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
            <div className="text-xs font-medium">Total owed to the store</div>
            <div className="text-xl font-bold">{formatPeso(totalOwed)}</div>
          </div>
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute inset-y-0 left-3 my-auto text-stone-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find customer…" className="pl-9" />
          </div>
        </div>
        <ul className="flex-1 divide-y divide-stone-100 overflow-y-auto">
          {list.map((c) => {
            const bal = balances.get(c.id!) ?? 0;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/utang/${c.id}`)}
                  className={`flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left ${
                    c.id === selectedId ? 'bg-red-50' : 'hover:bg-stone-50'
                  }`}
                >
                  <span className={`font-medium ${c.id === selectedId ? 'text-red-800' : ''}`}>{c.name}</span>
                  <span className={bal > 0 ? 'font-bold' : 'text-sm text-stone-400'}>{bal > 0 ? formatPeso(bal) : 'paid up'}</span>
                </button>
              </li>
            );
          })}
          {customers.length === 0 && (
            <li className="p-6 text-center text-sm text-stone-500">
              No customers yet. They're added here or when you choose “Utang” at checkout.
            </li>
          )}
        </ul>
      </section>

      <section className="min-w-0 flex-1 overflow-y-auto p-6">
        {selectedId !== undefined ? (
          <CustomerDetail key={selectedId} customerId={selectedId} balance={balances.get(selectedId) ?? 0} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center text-stone-500">
            <NotebookPen size={48} className="mb-3 text-stone-300" />
            Choose a customer to see what they owe and record payments.
          </div>
        )}
      </section>

      {adding && (
        <CustomerFormDialog
          onClose={() => setAdding(false)}
          onSaved={(id, name) => {
            setAdding(false);
            toast(`Added ${name}`);
            navigate(`/utang/${id}`);
          }}
        />
      )}
    </div>
  );
}

const TYPE_LABEL: Record<LedgerType, string> = { charge: 'Bought on utang', payment: 'Paid', void: 'Voided' };

function CustomerDetail({ customerId, balance }: { customerId: number; balance: number }) {
  const toast = useToast();
  const [paying, setPaying] = useState(false);
  const [editing, setEditing] = useState(false);

  const data = useLiveQuery(async () => {
    const customer = await db.customers.get(customerId);
    const entries = await db.ledger.where('customerId').equals(customerId).sortBy('createdAt');
    const saleIds = entries.flatMap((e) => (e.saleId !== undefined && e.type === 'charge' ? [e.saleId] : []));
    const sales = new Map((await db.sales.bulkGet(saleIds)).flatMap((s) => (s ? [[s.id!, s] as const] : [])));
    let running = 0;
    const rows = entries.map((e) => ({ ...e, running: (running += signedAmount(e)), sale: e.saleId ? sales.get(e.saleId) : undefined }));
    return { customer, rows: rows.reverse() };
  }, [customerId]);

  if (!data) return null;
  const { customer, rows } = data;
  if (!customer) return <p className="text-stone-500">Customer not found.</p>;
  const overLimit = customer.creditLimit !== undefined && balance > customer.creditLimit;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{customer.name}</h2>
          <p className="text-sm text-stone-500">
            {[customer.phone, customer.creditLimit !== undefined && `Credit limit ${formatPeso(customer.creditLimit)}`, customer.note]
              .filter(Boolean)
              .join(' · ') || 'No details'}
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          <Pencil size={16} /> Edit
        </Button>
      </div>

      <Card className="flex items-center justify-between p-5">
        <div>
          <div className="text-sm font-medium text-stone-500">Owes</div>
          <div className={`text-4xl font-bold ${balance > 0 ? '' : 'text-emerald-700'}`}>{formatPeso(balance)}</div>
          {overLimit && <div className="mt-1 text-sm font-semibold text-amber-700">Over credit limit</div>}
        </div>
        <Button variant="success" size="lg" disabled={balance <= 0} onClick={() => setPaying(true)}>
          <HandCoins size={20} /> Record payment
        </Button>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-50 text-stone-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">What</th>
              <th className="px-4 py-2.5 text-right font-medium">Amount</th>
              <th className="px-4 py-2.5 text-right font-medium">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2.5 whitespace-nowrap text-stone-500">{formatDateTime(r.createdAt)}</td>
                <td className="px-4 py-2.5">
                  <div className="font-medium">{TYPE_LABEL[r.type]}</div>
                  {r.sale && (
                    <div className={`text-stone-500 ${r.sale.voidedAt ? 'line-through' : ''}`}>{itemsSummary(r.sale.items)}</div>
                  )}
                  {r.note && <div className="text-stone-500">{r.note}</div>}
                </td>
                <td
                  className={`px-4 py-2.5 text-right font-semibold whitespace-nowrap ${r.type === 'charge' ? '' : 'text-emerald-700'}`}
                >
                  {r.type === 'charge' ? '+' : '−'}
                  {formatPeso(r.amount)}
                </td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap text-stone-600">{formatPeso(r.running)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-stone-500">
                  No utang history yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {paying && (
        <PaymentDialog
          customer={customer}
          balance={balance}
          onClose={() => setPaying(false)}
          onSaved={(amount) => {
            setPaying(false);
            toast(`${customer.name} paid ${formatPeso(amount)}`);
          }}
        />
      )}
      {editing && (
        <CustomerFormDialog
          customer={customer}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            toast('Customer saved');
          }}
        />
      )}
    </div>
  );
}

function PaymentDialog({
  customer,
  balance,
  onClose,
  onSaved,
}: {
  customer: Customer;
  balance: number;
  onClose: () => void;
  onSaved: (amount: number) => void;
}) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const value = parsePeso(amount);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (value === null) return setError('Enter a valid amount.');
    try {
      await recordPayment(customer.id!, value, note.trim() || undefined);
      onSaved(value);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Modal
      title={`Payment from ${customer.name}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="success" type="submit" form="payment-form">
            Save payment
          </Button>
        </>
      }
    >
      <form id="payment-form" onSubmit={submit} className="space-y-4">
        <p className="text-stone-600">
          Owes <strong>{formatPeso(balance)}</strong>
        </p>
        <Field label="Amount paid">
          <div className="flex gap-2">
            <div className="flex-1">
              <PesoInput value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus className="text-xl font-bold" />
            </div>
            <Button onClick={() => setAmount(pesoInputValue(balance))}>Pay all</Button>
          </div>
        </Field>
        {value !== null && value > 0 && value <= balance && (
          <p className="text-sm text-stone-600">
            Remaining after payment: <strong>{formatPeso(balance - value)}</strong>
          </p>
        )}
        <Field label="Note (optional)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. paid via GCash" />
        </Field>
        <ErrorText>{error}</ErrorText>
      </form>
    </Modal>
  );
}

function CustomerFormDialog({
  customer,
  onClose,
  onSaved,
}: {
  customer?: Customer;
  onClose: () => void;
  onSaved: (id: number, name: string) => void;
}) {
  const [name, setName] = useState(customer?.name ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [limit, setLimit] = useState(customer?.creditLimit !== undefined ? pesoInputValue(customer.creditLimit) : '');
  const [note, setNote] = useState(customer?.note ?? '');
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    const creditLimit = limit.trim() ? parsePeso(limit) : undefined;
    if (creditLimit === null) return setError('Credit limit is not a valid amount.');
    try {
      const id = await saveCustomer({ name, phone, note, creditLimit }, customer?.id);
      onSaved(id, name.trim());
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Modal
      title={customer ? 'Edit customer' : 'New customer'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="customer-form">
            Save
          </Button>
        </>
      }
    >
      <form id="customer-form" onSubmit={submit} className="space-y-3">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Aling Nena" />
        </Field>
        <Field label="Phone (optional)">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
        </Field>
        <Field label="Credit limit (optional)" hint="You'll get a warning at checkout if utang goes above this.">
          <PesoInput value={limit} onChange={(e) => setLimit(e.target.value)} />
        </Field>
        <Field label="Note (optional)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. pays every 15th" />
        </Field>
        <ErrorText>{error}</ErrorText>
      </form>
    </Modal>
  );
}
