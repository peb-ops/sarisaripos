import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type FormEvent } from 'react';
import { db, type Product, type StockReason } from '../db/schema';
import { adjustStock, restock } from '../lib/inventory';
import { formatDateTime } from '../lib/format';
import { formatPeso, parsePeso } from '../lib/money';
import { Modal } from './Modal';
import { Button, Chip, ErrorText, Field, Input, PesoInput, errorMessage } from './ui';

const REASON_LABEL: Record<StockReason, string> = {
  sale: 'Sold',
  restock: 'Restocked',
  adjust: 'Count / adjust',
  void: 'Voided sale',
};

export function StockDialog({ product, onClose, onSaved }: { product: Product; onClose: () => void; onSaved: (msg: string) => void }) {
  const [mode, setMode] = useState<'restock' | 'count'>('restock');
  const [unitIndex, setUnitIndex] = useState(product.units.length - 1); // biggest unit is usually how it's bought
  const [qty, setQty] = useState('');
  const [paid, setPaid] = useState('');
  const [counted, setCounted] = useState(String(product.stock));
  const [error, setError] = useState('');

  const moves = useLiveQuery(
    () => db.stockMoves.where('productId').equals(product.id!).reverse().limit(8).toArray(),
    [product.id],
  );

  const unit = product.units[unitIndex];
  const qtyBase = Number(qty) * unit.qtyInBase;
  const paidValue = paid.trim() ? parsePeso(paid) : undefined;
  const base = product.baseUnit;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      if (mode === 'restock') {
        if (paidValue === null) return setError('Amount paid is not valid.');
        await restock(product.id!, qtyBase, paidValue);
        onSaved(`Added ${qtyBase} ${base} of ${product.name}`);
      } else {
        await adjustStock(product.id!, Number(counted));
        onSaved(`${product.name} stock set to ${counted} ${base}`);
      }
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Modal
      title={`Stock: ${product.name}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="stock-form">
            {mode === 'restock' ? 'Add stock' : 'Save count'}
          </Button>
        </>
      }
    >
      <div className="mb-4 rounded-xl bg-stone-100 p-3 text-center">
        <div className="text-sm text-stone-500">In stock now</div>
        <div className="text-3xl font-bold">
          {product.stock} <span className="text-lg font-semibold text-stone-500">{base}</span>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        <Chip active={mode === 'restock'} onClick={() => setMode('restock')}>
          Restock (bought more)
        </Chip>
        <Chip active={mode === 'count'} onClick={() => setMode('count')}>
          Correct the count
        </Chip>
      </div>

      <form id="stock-form" onSubmit={submit} className="space-y-3">
        {mode === 'restock' ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="How many?">
                <Input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
              </Field>
              <Field label="Of">
                <select
                  value={unitIndex}
                  onChange={(e) => setUnitIndex(Number(e.target.value))}
                  className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2"
                >
                  {product.units.map((u, i) => (
                    <option key={u.name} value={i}>
                      {u.name}
                      {u.qtyInBase > 1 ? ` (${u.qtyInBase} ${base})` : ''}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Total amount paid (optional)" hint="Fill this in to update your cost and profit numbers.">
              <PesoInput value={paid} onChange={(e) => setPaid(e.target.value)} />
            </Field>
            {qtyBase > 0 && (
              <p className="text-sm text-stone-600">
                Adds <strong>{qtyBase} {base}</strong> → new stock {product.stock + qtyBase} {base}
                {paidValue ? (
                  <>
                    {' '}
                    · cost {formatPeso(paidValue / qtyBase)} per {base}
                  </>
                ) : null}
              </p>
            )}
          </>
        ) : (
          <Field label={`Actual count (${base})`} hint="Count what's on the shelf and enter the exact number.">
            <Input type="number" value={counted} onChange={(e) => setCounted(e.target.value)} autoFocus />
          </Field>
        )}
        <ErrorText>{error}</ErrorText>
      </form>

      {moves && moves.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-sm font-semibold text-stone-500">Recent changes</h3>
          <ul className="divide-y divide-stone-100 text-sm">
            {moves.map((m) => (
              <li key={m.id} className="flex justify-between py-1.5">
                <span>
                  {REASON_LABEL[m.reason]}
                  {m.note && <span className="text-stone-400"> · {m.note}</span>}
                  <span className="ml-2 text-stone-400">{formatDateTime(m.createdAt)}</span>
                </span>
                <span className={m.delta < 0 ? 'text-stone-600' : 'font-semibold text-emerald-700'}>
                  {m.delta > 0 ? '+' : ''}
                  {m.delta}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
