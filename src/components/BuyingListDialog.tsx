import { Printer } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { Product } from '../db/schema';
import { useSetting } from '../hooks';
import { buyingList, type BuyGroup } from '../lib/buyingList';
import { formatDate } from '../lib/format';
import { formatPeso } from '../lib/money';
import { Modal } from './Modal';
import { Button } from './ui';

/** Low-stock items to buy, by supplier. Prints as a plain checklist to take shopping. */
export function BuyingListDialog({ products, onClose }: { products: Product[]; onClose: () => void }) {
  const storeName = useSetting('storeName', 'Sari-Sari Store');
  const groups = buyingList(products);
  const total = groups.reduce((s, g) => s + g.cost, 0);

  return (
    <Modal
      title="Buying list"
      onClose={onClose}
      wide
      footer={
        <>
          <Button onClick={onClose}>Close</Button>
          <Button variant="primary" disabled={groups.length === 0} onClick={() => window.print()}>
            <Printer size={18} /> Print
          </Button>
        </>
      }
    >
      {groups.length === 0 ? (
        <p className="py-6 text-center text-stone-500">Nothing is low on stock. Nothing to buy yet.</p>
      ) : (
        <>
          <p className="mb-4 text-sm text-stone-500">
            Items at or below their low-stock level. "Buy" brings each back to twice that level; change it as you like when
            shopping. Costs use the last price you paid.
          </p>
          <BuyTables groups={groups} />
          <p className="mt-4 text-right text-lg font-bold">Estimated total {formatPeso(total)}</p>
        </>
      )}
      {createPortal(
        <div className="hidden p-6 text-black print:block">
          <h1 className="text-xl font-bold">Buying list: {storeName}</h1>
          <p className="mb-4 text-sm">{formatDate(Date.now())}</p>
          <BuyTables groups={groups} print />
          <p className="mt-4 text-right font-bold">Estimated total {formatPeso(total)}</p>
        </div>,
        document.body,
      )}
    </Modal>
  );
}

function BuyTables({ groups, print = false }: { groups: BuyGroup[]; print?: boolean }) {
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <section key={g.supplier} className="break-inside-avoid">
          <h3 className="mb-1 flex justify-between font-bold">
            <span>{g.supplier}</span>
            <span className="font-semibold text-stone-600">{formatPeso(g.cost)}</span>
          </h3>
          <table className="w-full text-sm">
            <thead className="text-stone-500">
              <tr className="border-b border-stone-200">
                {print && <th className="w-8 py-1" />}
                <th className="py-1 text-left font-medium">Product</th>
                <th className="py-1 text-right font-medium">Stock now</th>
                <th className="py-1 text-right font-medium">Buy</th>
                <th className="py-1 text-right font-medium">Est. cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {g.items.map(({ product: p, qtyBase, inBiggestUnit, cost }) => (
                <tr key={p.id}>
                  {print && <td className="py-1.5 text-lg">☐</td>}
                  <td className="py-1.5 font-medium">{p.name}</td>
                  <td className="py-1.5 text-right whitespace-nowrap text-stone-600">
                    {p.stock} {p.baseUnit}
                  </td>
                  <td className="py-1.5 text-right font-semibold whitespace-nowrap">
                    {qtyBase} {p.baseUnit}
                    {inBiggestUnit && <span className="font-normal text-stone-500"> (≈ {inBiggestUnit})</span>}
                  </td>
                  <td className="py-1.5 text-right whitespace-nowrap">{p.costPerBase > 0 ? formatPeso(cost) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
