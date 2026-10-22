import { Archive, PackagePlus, Pencil, Search, TriangleAlert, Warehouse } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ProductFormDialog } from '../components/ProductFormDialog';
import { ProductThumb } from '../components/ProductThumb';
import { StockDialog } from '../components/StockDialog';
import { useToast } from '../components/Toast';
import { Button, Card, Chip, PageHeader } from '../components/ui';
import type { Product } from '../db/schema';
import { seedDemoData } from '../db/seed';
import { useProducts } from '../hooks';
import { isLowStock } from '../lib/inventory';
import { formatPeso } from '../lib/money';

type Filter = 'all' | 'low' | 'archived';

export default function Products() {
  const products = useProducts();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [stockFor, setStockFor] = useState<Product | null>(null);

  const all = products ?? [];
  const categories = useMemo(() => [...new Set(all.map((p) => p.category))].sort(), [all]);
  const lowCount = all.filter((p) => p.active && isLowStock(p)).length;
  const archivedCount = all.filter((p) => !p.active).length;

  const q = query.trim().toLowerCase();
  const rows = all.filter((p) => {
    if (filter === 'archived' ? p.active : !p.active) return false;
    if (filter === 'low' && !isLowStock(p)) return false;
    return !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.barcode === query.trim();
  });

  return (
    <div className="h-full overflow-y-auto p-6">
      <PageHeader title="Products" subtitle={`${all.length - archivedCount} items for sale`}>
        <Button variant="primary" onClick={() => setEditing('new')}>
          <PackagePlus size={18} /> Add product
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search size={18} className="pointer-events-none absolute inset-y-0 left-3 my-auto text-stone-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products…"
            className="w-full rounded-lg border border-stone-300 bg-white py-2 pr-3 pl-10 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-200"
          />
        </div>
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
          All
        </Chip>
        <Chip active={filter === 'low'} onClick={() => setFilter('low')}>
          Low stock{lowCount > 0 && ` (${lowCount})`}
        </Chip>
        {archivedCount > 0 && (
          <Chip active={filter === 'archived'} onClick={() => setFilter('archived')}>
            Archived ({archivedCount})
          </Chip>
        )}
      </div>

      {products && all.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="mb-4 text-stone-600">No products yet. Add your first one, or start with sample sari-sari items.</p>
          <div className="flex justify-center gap-2">
            <Button variant="primary" onClick={() => setEditing('new')}>
              <PackagePlus size={18} /> Add product
            </Button>
            <Button
              onClick={async () => {
                await seedDemoData();
                toast('Sample products loaded');
              }}
            >
              Load sample products
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-stone-50 text-sm text-stone-500">
              <tr>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Selling price</th>
                <th className="px-4 py-3 text-right font-medium">Cost</th>
                <th className="px-4 py-3 text-right font-medium">Stock</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((p) => {
                const low = isLowStock(p);
                return (
                  <tr key={p.id} className="hover:bg-stone-50/60">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <ProductThumb product={p} className="size-10 shrink-0 rounded-lg text-sm" />
                        <div>
                          <div className="font-semibold">{p.name}</div>
                          <div className="text-xs text-stone-500">{p.category}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-sm">
                      {p.units.map((u) => (
                        <span key={u.name} className="mr-3 inline-block whitespace-nowrap">
                          <span className="text-stone-500">{u.name}</span> <strong>{formatPeso(u.price)}</strong>
                        </span>
                      ))}
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm whitespace-nowrap text-stone-600">
                      {formatPeso(p.costPerBase)}
                      <span className="text-stone-400"> / {p.baseUnit}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <span className={low ? 'font-bold text-amber-700' : 'font-semibold'}>
                        {low && <TriangleAlert size={14} className="mr-1 inline align-[-2px]" />}
                        {p.stock}
                      </span>{' '}
                      <span className="text-sm text-stone-500">{p.baseUnit}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" onClick={() => setStockFor(p)}>
                          <Warehouse size={16} /> Stock
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(p)} aria-label={`Edit ${p.name}`}>
                          <Pencil size={16} /> Edit
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-stone-500">
                    {filter === 'low' ? (
                      'Nothing is low on stock.'
                    ) : filter === 'archived' ? (
                      <>
                        <Archive className="mx-auto mb-2" /> No archived products.
                      </>
                    ) : (
                      'No products match your search.'
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      {editing && (
        <ProductFormDialog
          product={editing === 'new' ? undefined : editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={(name) => {
            setEditing(null);
            toast(`Saved ${name}`);
          }}
        />
      )}
      {stockFor && (
        <StockDialog
          product={stockFor}
          onClose={() => setStockFor(null)}
          onSaved={(msg) => {
            setStockFor(null);
            toast(msg);
          }}
        />
      )}
    </div>
  );
}
