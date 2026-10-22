import { useLiveQuery } from 'dexie-react-hooks';
import { Ban, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts';
import { ConfirmDialog } from '../components/Modal';
import { useToast } from '../components/Toast';
import { Button, Card, Chip, PageHeader, errorMessage } from '../components/ui';
import { db, type PaymentType, type Sale } from '../db/schema';
import { useBalances, useCustomers, useProducts } from '../hooks';
import { formatDateTime, itemsSummary } from '../lib/format';
import { formatPeso } from '../lib/money';
import { bestSellers, dailySeries, lowStock, rangeStart, summarize, type DayPoint, type Range } from '../lib/reports';
import { voidSale } from '../lib/sales';

const RANGES: { id: Range; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
];

const PAYMENT_LABEL: Record<PaymentType, string> = { cash: 'Cash', gcash: 'GCash', utang: 'Utang' };

// Single-series chart: one hue, not a status color (green/red would read as good/bad).
const BAR_COLOR = '#4f46e5';

export default function Reports() {
  const [range, setRange] = useState<Range>('today');
  const [voiding, setVoiding] = useState<Sale | null>(null);
  const toast = useToast();
  const start = rangeStart(range);

  const sales = useLiveQuery(() => db.sales.where('createdAt').aboveOrEqual(start).reverse().toArray(), [start]);
  const products = useProducts() ?? [];
  const customers = useCustomers() ?? [];
  const balances = useBalances() ?? new Map<number, number>();

  if (!sales) return null;

  const summary = summarize(sales);
  const series = dailySeries(sales, start);
  const top = bestSellers(sales);
  const low = lowStock(products);
  const owed = [...balances.values()].reduce((s, b) => s + Math.max(0, b), 0);
  const customerName = new Map(customers.map((c) => [c.id!, c.name]));
  const productUnit = new Map(products.map((p) => [p.id!, p.baseUnit]));

  return (
    <div className="h-full overflow-y-auto p-6">
      <PageHeader title="Reports">
        {RANGES.map((r) => (
          <Chip key={r.id} active={range === r.id} onClick={() => setRange(r.id)}>
            {r.label}
          </Chip>
        ))}
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Sales" value={formatPeso(summary.revenue)} sub={`${summary.count} transaction${summary.count === 1 ? '' : 's'}`} />
        <Stat
          label="Gross profit"
          value={formatPeso(summary.profit)}
          sub={summary.revenue ? `${Math.round((summary.profit / summary.revenue) * 100)}% margin` : '—'}
        />
        <Stat
          label="Received"
          value={formatPeso(summary.byPayment.cash + summary.byPayment.gcash)}
          sub={`Cash ${formatPeso(summary.byPayment.cash)} · GCash ${formatPeso(summary.byPayment.gcash)}`}
        />
        <Stat label="Sold on utang" value={formatPeso(summary.byPayment.utang)} sub={`All customers owe ${formatPeso(owed)}`} />
      </div>

      {range !== 'today' && (
        <Card className="mb-5 p-5">
          <h2 className="mb-1 font-bold">Sales per day</h2>
          <p className="mb-4 text-sm text-stone-500">Hover a bar for sales and profit.</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap={2}>
                <CartesianGrid vertical={false} stroke="#e7e5e4" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={{ stroke: '#d6d3d1' }}
                  tick={{ fill: '#78716c', fontSize: 12 }}
                  interval="preserveStartEnd"
                  minTickGap={16}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={64}
                  tick={{ fill: '#78716c', fontSize: 12 }}
                  tickFormatter={(v: number) => `₱${(v / 100).toLocaleString('en-PH', { notation: 'compact' })}`}
                />
                <Tooltip cursor={{ fill: '#f5f5f4' }} content={<DayTooltip />} />
                <Bar dataKey="revenue" name="Sales" fill={BAR_COLOR} radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-stone-500">View as table</summary>
            <table className="mt-2 w-full">
              <thead className="text-stone-500">
                <tr>
                  <th className="py-1 text-left font-medium">Day</th>
                  <th className="py-1 text-right font-medium">Sales</th>
                  <th className="py-1 text-right font-medium">Profit</th>
                </tr>
              </thead>
              <tbody>
                {series.map((d) => (
                  <tr key={d.key} className="border-t border-stone-100">
                    <td className="py-1">{d.label}</td>
                    <td className="py-1 text-right">{formatPeso(d.revenue)}</td>
                    <td className="py-1 text-right">{formatPeso(d.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </Card>
      )}

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <h2 className="px-5 pt-4 pb-2 font-bold">Best sellers</h2>
          <table className="w-full text-sm">
            <thead className="text-stone-500">
              <tr>
                <th className="px-5 py-2 text-left font-medium">Product</th>
                <th className="px-5 py-2 text-right font-medium">Sold</th>
                <th className="px-5 py-2 text-right font-medium">Sales</th>
                <th className="px-5 py-2 text-right font-medium">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {top.map((t) => (
                <tr key={t.productId}>
                  <td className="px-5 py-2 font-medium">{t.name}</td>
                  <td className="px-5 py-2 text-right whitespace-nowrap text-stone-600">
                    {t.qtyBase} {productUnit.get(t.productId) ?? ''}
                  </td>
                  <td className="px-5 py-2 text-right">{formatPeso(t.revenue)}</td>
                  <td className="px-5 py-2 text-right text-stone-600">{formatPeso(t.profit)}</td>
                </tr>
              ))}
              {top.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-6 text-center text-stone-500">
                    No sales in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>

        <Card className="overflow-hidden">
          <h2 className="flex items-center gap-2 px-5 pt-4 pb-2 font-bold">
            <TriangleAlert size={18} className="text-amber-600" /> Low stock, buy soon
          </h2>
          <ul className="divide-y divide-stone-100 text-sm">
            {low.map((p) => (
              <li key={p.id} className="flex justify-between px-5 py-2">
                <span className="font-medium">{p.name}</span>
                <span className="font-semibold text-amber-700">
                  {p.stock} {p.baseUnit} left
                </span>
              </li>
            ))}
            {low.length === 0 && <li className="px-5 py-6 text-center text-stone-500">Everything is well stocked.</li>}
          </ul>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <h2 className="px-5 pt-4 pb-2 font-bold">Sales</h2>
        <table className="w-full text-sm">
          <thead className="text-stone-500">
            <tr>
              <th className="px-5 py-2 text-left font-medium">#</th>
              <th className="px-5 py-2 text-left font-medium">Time</th>
              <th className="px-5 py-2 text-left font-medium">Items</th>
              <th className="px-5 py-2 text-left font-medium">Payment</th>
              <th className="px-5 py-2 text-right font-medium">Total</th>
              <th className="px-5 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {sales.map((s) => (
              <tr key={s.id} className={s.voidedAt ? 'text-stone-400' : ''}>
                <td className="px-5 py-2">{s.id}</td>
                <td className="px-5 py-2 whitespace-nowrap">{formatDateTime(s.createdAt)}</td>
                <td className={`px-5 py-2 ${s.voidedAt ? 'line-through' : ''}`}>{itemsSummary(s.items)}</td>
                <td className="px-5 py-2 whitespace-nowrap">
                  {PAYMENT_LABEL[s.payment]}
                  {s.customerId !== undefined && <span className="text-stone-500"> · {customerName.get(s.customerId) ?? '?'}</span>}
                </td>
                <td className={`px-5 py-2 text-right font-semibold ${s.voidedAt ? 'line-through' : ''}`}>{formatPeso(s.total)}</td>
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
            {sales.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-stone-500">
                  No sales in this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {voiding && (
        <ConfirmDialog
          title={`Void sale #${voiding.id}?`}
          confirmLabel="Void sale"
          message={
            <>
              <p>
                {itemsSummary(voiding.items, 10)}: <strong>{formatPeso(voiding.total)}</strong>
              </p>
              <p className="mt-2 text-sm text-stone-500">
                The items go back into stock
                {voiding.payment === 'utang' ? ' and the amount is removed from the customer’s utang' : ''}. Return any cash to
                the customer yourself.
              </p>
            </>
          }
          onClose={() => setVoiding(null)}
          onConfirm={async () => {
            try {
              await voidSale(voiding.id!);
              toast(`Sale #${voiding.id} voided`);
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

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card className="p-4">
      <div className="text-sm font-medium text-stone-500">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      <div className="mt-1 text-xs text-stone-500">{sub}</div>
    </Card>
  );
}

function DayTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as DayPoint;
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm shadow-md">
      <div className="font-semibold">{d.label}</div>
      <div>Sales {formatPeso(d.revenue)}</div>
      <div className="text-stone-500">Profit {formatPeso(d.profit)}</div>
    </div>
  );
}
