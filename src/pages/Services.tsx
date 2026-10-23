import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowDownLeft, ArrowUpRight, Ban, Banknote, NotebookPen, Plus, Receipt, Scale, Smartphone, TriangleAlert } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { CustomerPicker } from '../components/CheckoutDialog';
import { ExportMenu } from '../components/ExportMenu';
import { ConfirmDialog, Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { Button, Card, ErrorText, Field, Input, PageHeader, PesoInput, errorMessage } from '../components/ui';
import { db, type Service, type ServiceKind, type WalletId } from '../db/schema';
import { useCustomers, useServiceFees, useWalletBalances } from '../hooks';
import { exportCsv, exportExcel } from '../lib/exportFiles';
import { formatDateTime } from '../lib/format';
import { formatPeso, parsePeso, pesoInputValue } from '../lib/money';
import { rangeStart } from '../lib/reports';
import {
  SERVICES,
  WALLET_LABEL,
  cashEffect,
  defaultFee,
  describeService,
  recordService,
  setWalletBalance,
  summarizeServices,
  topUpWallet,
  voidService,
  walletEffect,
  type ServiceFees,
} from '../lib/services';

const KINDS: { kind: ServiceKind; icon: typeof Smartphone; sub: string }[] = [
  { kind: 'eload', icon: Smartphone, sub: 'Load to a phone' },
  { kind: 'cashin', icon: ArrowUpRight, sub: 'Customer gives cash, you send GCash' },
  { kind: 'cashout', icon: ArrowDownLeft, sub: 'Customer sends GCash, you give cash' },
  { kind: 'bills', icon: Receipt, sub: 'Meralco, water, internet…' },
];

/** Quick amounts in centavos. */
const QUICK: Record<ServiceKind, number[]> = {
  eload: [1000, 1500, 2000, 3000, 5000, 10000, 30000, 50000],
  cashin: [10000, 50000, 100000, 200000, 500000],
  cashout: [10000, 50000, 100000, 200000, 500000],
  bills: [],
};

export default function Services() {
  const toast = useToast();
  const balances = useWalletBalances();
  const fees = useServiceFees();
  const customers = useCustomers() ?? [];
  const [kind, setKind] = useState<ServiceKind | null>(null);
  const [walletAction, setWalletAction] = useState<{ wallet: WalletId; mode: 'topup' | 'set' } | null>(null);
  const [voiding, setVoiding] = useState<Service | null>(null);

  const today = rangeStart('today');
  const todays = useLiveQuery(() => db.services.where('createdAt').aboveOrEqual(today).toArray(), [today]);
  const recent = useLiveQuery(() => db.services.orderBy('createdAt').reverse().limit(100).toArray(), []);
  const sum = summarizeServices(todays ?? []);
  const customerName = new Map(customers.map((c) => [c.id!, c.name]));

  return (
    <div className="h-full overflow-y-auto p-6">
      <PageHeader title="Load & GCash" subtitle="E-load, GCash cash-in / cash-out and bills payment">
        <ExportMenu
          items={[
            { label: 'Load & GCash history (Excel)', format: 'excel', run: () => exportExcel('services') },
            { label: 'Load & GCash history (CSV)', format: 'csv', run: () => exportCsv('services', { table: 'Load & GCash' }) },
          ]}
        />
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {KINDS.map(({ kind: k, icon: Icon, sub }) => (
          <button
            key={k}
            type="button"
            disabled={!fees || !balances}
            onClick={() => setKind(k)}
            className="flex cursor-pointer flex-col items-start gap-2 rounded-xl border-2 border-stone-200 bg-white p-4 text-left transition-colors hover:border-red-600 hover:bg-red-50 disabled:cursor-wait"
          >
            <span className="rounded-lg bg-red-700 p-2 text-white">
              <Icon size={22} />
            </span>
            <span className="text-lg font-bold">{SERVICES[k].label}</span>
            <span className="text-sm text-stone-500">{sub}</span>
          </button>
        ))}
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        {(['load', 'gcash'] as WalletId[]).map((w) => {
          const balance = balances?.[w] ?? 0;
          return (
            <Card key={w} className="p-4">
              <div className="text-sm font-medium text-stone-500">{WALLET_LABEL[w]}</div>
              <div className={`mt-1 text-2xl font-bold ${balance < 0 ? 'text-amber-700' : ''}`}>{formatPeso(balance)}</div>
              {balance < 0 && (
                <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-amber-700">
                  <TriangleAlert size={14} /> Below zero: top up or correct the balance
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={() => setWalletAction({ wallet: w, mode: 'topup' })}>
                  <Plus size={16} /> Top up
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setWalletAction({ wallet: w, mode: 'set' })}>
                  <Scale size={16} /> Correct balance
                </Button>
              </div>
            </Card>
          );
        })}
        <Card className="p-4">
          <div className="text-sm font-medium text-stone-500">Earned today</div>
          <div className="mt-1 text-2xl font-bold">{formatPeso(sum.income)}</div>
          <div className="mt-1 text-xs text-stone-500">
            {sum.count} transaction{sum.count === 1 ? '' : 's'} · markups and fees
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <h2 className="px-5 pt-4 pb-2 font-bold">Recent</h2>
        <table className="w-full text-sm">
          <thead className="text-stone-500">
            <tr>
              <th className="px-5 py-2 text-left font-medium">Time</th>
              <th className="px-5 py-2 text-left font-medium">Service</th>
              <th className="px-5 py-2 text-right font-medium">Fee</th>
              <th className="px-5 py-2 text-right font-medium">Cash</th>
              <th className="px-5 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {(recent ?? []).map((s) => (
              <tr key={s.id} className={s.voidedAt ? 'text-stone-400' : ''}>
                <td className="px-5 py-2 whitespace-nowrap">{formatDateTime(s.createdAt)}</td>
                <td className={`px-5 py-2 ${s.voidedAt ? 'line-through' : ''}`}>
                  {describeService(s)}
                  {s.payment === 'utang' && (
                    <span className="text-stone-500"> · Utang: {customerName.get(s.customerId!) ?? '?'}</span>
                  )}
                </td>
                <td className="px-5 py-2 text-right">{formatPeso(s.fee)}</td>
                <td className={`px-5 py-2 text-right font-semibold whitespace-nowrap ${s.voidedAt ? 'line-through' : ''}`}>
                  {s.payment === 'utang' ? '—' : cashEffect(s) < 0 ? `−${formatPeso(-cashEffect(s))}` : `+${formatPeso(cashEffect(s))}`}
                </td>
                <td className="px-5 py-2 text-right">
                  {s.voidedAt ? (
                    <span className="text-xs font-semibold uppercase">Voided</span>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setVoiding(s)}>
                      <Ban size={14} /> Void
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {recent?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-stone-500">
                  Nothing yet. Tap a service above to record one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {kind && fees && balances && (
        <ServiceDialog
          kind={kind}
          fees={fees}
          walletBalance={balances[SERVICES[kind].wallet]}
          onClose={() => setKind(null)}
          onDone={(s) => {
            setKind(null);
            toast(`Recorded: ${describeService(s)}`);
          }}
        />
      )}
      {walletAction && (
        <WalletDialog
          {...walletAction}
          balance={balances?.[walletAction.wallet] ?? 0}
          onClose={() => setWalletAction(null)}
          onDone={(msg) => {
            setWalletAction(null);
            toast(msg);
          }}
        />
      )}
      {voiding && (
        <ConfirmDialog
          title="Void this?"
          confirmLabel="Void"
          message={
            <>
              <p>
                <strong>{describeService(voiding)}</strong> at {formatDateTime(voiding.createdAt)}
              </p>
              <p className="mt-2 text-sm text-stone-500">
                The {WALLET_LABEL[SERVICES[voiding.kind].wallet].toLowerCase()} goes back to how it was
                {voiding.payment === 'utang' ? ' and the amount is removed from the customer’s utang' : ''}. Settle any cash
                with the customer yourself.
              </p>
            </>
          }
          onClose={() => setVoiding(null)}
          onConfirm={async () => {
            try {
              await voidService(voiding.id!);
              toast('Voided');
            } catch (err) {
              toast(errorMessage(err), 'error');
            }
            setVoiding(null);
          }}
        />
      )}
    </div>
  );
}

function ServiceDialog({
  kind,
  fees,
  walletBalance,
  onClose,
  onDone,
}: {
  kind: ServiceKind;
  fees: ServiceFees;
  walletBalance: number;
  onClose: () => void;
  onDone: (s: Service) => void;
}) {
  const info = SERVICES[kind];
  const [amount, setAmount] = useState('');
  // The fee follows the amount until the owner types their own.
  const [fee, setFee] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [payment, setPayment] = useState<'cash' | 'utang'>('cash');
  const [customerId, setCustomerId] = useState<number>();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const amountValue = parsePeso(amount);
  const feeValue = fee === null ? defaultFee(kind, amountValue ?? 0, fees) : parsePeso(fee);
  const valid = amountValue !== null && amountValue > 0 && feeValue !== null;
  const preview = valid ? { kind, amount: amountValue, fee: feeValue } : null;
  const walletAfter = preview ? walletBalance + walletEffect(preview) : walletBalance;
  const canConfirm = !saving && valid && (payment === 'cash' || customerId !== undefined);

  async function confirm(e?: FormEvent) {
    e?.preventDefault();
    if (!canConfirm) return;
    setSaving(true);
    setError('');
    try {
      onDone(await recordService({ kind, amount: amountValue!, fee: feeValue!, payment, customerId, details }));
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal
      title={info.label}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="success" size="lg" disabled={!canConfirm} onClick={() => confirm()}>
            Done
          </Button>
        </>
      }
    >
      <form onSubmit={confirm} className="space-y-4">
        <div className="grid grid-cols-[1fr_9rem] gap-3">
          <Field label={kind === 'eload' ? 'Load amount' : kind === 'bills' ? 'Bill amount' : 'GCash amount'}>
            <PesoInput value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus className="py-3 text-2xl font-bold" />
          </Field>
          <Field label={info.feeLabel}>
            <PesoInput
              value={fee ?? pesoInputValue(feeValue ?? 0)}
              onChange={(e) => setFee(e.target.value)}
              className="py-3 text-2xl font-bold"
            />
          </Field>
        </div>
        {QUICK[kind].length > 0 && (
          <div className="flex flex-wrap gap-2">
            {QUICK[kind].map((q) => (
              <Button key={q} size="sm" onClick={() => setAmount(String(q / 100))}>
                {formatPeso(q).replace('.00', '')}
              </Button>
            ))}
          </div>
        )}
        <Field label={`${info.detailsLabel} (optional)`}>
          <Input value={details} onChange={(e) => setDetails(e.target.value)} />
        </Field>

        {kind === 'eload' && (
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Payment">
            {(
              [
                ['cash', 'Cash', Banknote],
                ['utang', 'Utang', NotebookPen],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={payment === id}
                onClick={() => setPayment(id)}
                className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 py-2.5 font-semibold transition-colors ${
                  payment === id ? 'border-red-600 bg-red-50 text-red-800' : 'border-stone-200 hover:bg-stone-50'
                }`}
              >
                <Icon size={20} /> {label}
              </button>
            ))}
          </div>
        )}
        {payment === 'utang' && preview && (
          <CustomerPicker total={cashEffect(preview)} selected={customerId} onSelect={setCustomerId} />
        )}

        {preview && (
          <div className="rounded-xl bg-emerald-50 p-4 text-center text-emerald-900">
            {kind === 'cashout' ? (
              <>
                <div className="text-sm font-medium">
                  Check that {formatPeso(preview.amount)} arrived in your GCash, then give the customer
                </div>
                <div className="text-4xl font-bold">{formatPeso(-cashEffect(preview))}</div>
              </>
            ) : (
              <>
                <div className="text-sm font-medium">{payment === 'utang' ? 'Add to utang' : 'Collect from customer'}</div>
                <div className="text-4xl font-bold">{formatPeso(cashEffect(preview))}</div>
              </>
            )}
          </div>
        )}
        <p className={`text-sm ${walletAfter < 0 ? 'font-semibold text-amber-700' : 'text-stone-500'}`}>
          {walletAfter < 0 && <TriangleAlert size={14} className="mr-1 inline align-[-2px]" />}
          {WALLET_LABEL[info.wallet]}: {formatPeso(walletBalance)} now → {formatPeso(walletAfter)} after
          {walletAfter < 0 && '. Not enough: top up first, or correct the balance if it is wrong.'}
        </p>

        <ErrorText>{error}</ErrorText>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function WalletDialog({
  wallet,
  mode,
  balance,
  onClose,
  onDone,
}: {
  wallet: WalletId;
  mode: 'topup' | 'set';
  balance: number;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const parsed = parsePeso(value);
  const label = WALLET_LABEL[wallet];

  async function save(e?: FormEvent) {
    e?.preventDefault();
    if (parsed === null) return setError('Enter a valid amount.');
    try {
      if (mode === 'topup') {
        await topUpWallet(wallet, parsed, note);
        onDone(`${label}: added ${formatPeso(parsed)}`);
      } else {
        await setWalletBalance(wallet, parsed);
        onDone(`${label} set to ${formatPeso(parsed)}`);
      }
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Modal
      title={mode === 'topup' ? `Top up ${label.toLowerCase()}` : `Correct ${label.toLowerCase()}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={parsed === null} onClick={() => save()}>
            Save
          </Button>
        </>
      }
    >
      <form onSubmit={save} className="space-y-4">
        <p className="text-sm text-stone-600">
          {mode === 'topup'
            ? `How much was added to your ${label.toLowerCase()}? (Now ${formatPeso(balance)}.)`
            : `Type the balance shown in your ${wallet === 'load' ? 'load retailer' : 'GCash'} app. The POS shows ${formatPeso(balance)}.`}
        </p>
        <Field label={mode === 'topup' ? 'Amount added' : 'Actual balance'}>
          <PesoInput value={value} onChange={(e) => setValue(e.target.value)} autoFocus className="py-3 text-2xl font-bold" />
        </Field>
        {mode === 'topup' && (
          <Field label="Note (optional)">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. bought from Puregold" />
          </Field>
        )}
        <ErrorText>{error}</ErrorText>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
