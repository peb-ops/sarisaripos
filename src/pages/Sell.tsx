import { useLiveQuery } from 'dexie-react-hooks';
import { Minus, PackageOpen, Plus, Search, ShoppingCart, Trash2, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { CheckoutDialog } from '../components/CheckoutDialog';
import { Modal } from '../components/Modal';
import { ProductThumb } from '../components/ProductThumb';
import { useToast } from '../components/Toast';
import { Button, Chip } from '../components/ui';
import { db, type Product } from '../db/schema';
import { AssignBarcodeDialog } from '../features/barcode/AssignBarcodeDialog';
import { useBarcodeScanner } from '../features/barcode/useBarcodeScanner';
import { useFlag, useProducts } from '../hooks';
import { isLowStock } from '../lib/inventory';
import { formatPeso } from '../lib/money';
import { rangeStart, summarize } from '../lib/reports';
import { useCart } from '../state/cart';

export default function Sell() {
  const products = useProducts();
  const cart = useCart();
  const toast = useToast();
  const barcodeOn = useFlag('barcode');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [picking, setPicking] = useState<Product | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [unknownCode, setUnknownCode] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const todayStart = rangeStart('today');
  const today = useLiveQuery(
    async () => summarize(await db.sales.where('createdAt').aboveOrEqual(todayStart).toArray()),
    [todayStart],
  );

  const active = useMemo(() => (products ?? []).filter((p) => p.active), [products]);
  const byId = useMemo(() => new Map((products ?? []).map((p) => [p.id!, p])), [products]);
  const categories = useMemo(() => [...new Set(active.map((p) => p.category))].sort(), [active]);

  const q = query.trim().toLowerCase();
  const visible = active.filter(
    (p) =>
      (!category || p.category === category) &&
      (!q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.barcode === query.trim()),
  );

  const lines = cart.items.map((item, index) => {
    const product = byId.get(item.productId);
    return { ...item, index, product, unit: product?.units[item.unitIndex] };
  });
  const hasBrokenLine = lines.some((l) => !l.product || !l.unit);
  const total = lines.reduce((sum, l) => sum + (l.unit ? l.unit.price * l.qty : 0), 0);
  const canCheckout = lines.length > 0 && !hasBrokenLine;

  // How many base units the cart takes from each product, to warn about stock.
  const needed = new Map<number, number>();
  for (const l of lines) if (l.unit) needed.set(l.productId, (needed.get(l.productId) ?? 0) + l.unit.qtyInBase * l.qty);

  function pick(product: Product) {
    if (product.units.length === 1) cart.add(product.id!, 0);
    else setPicking(product);
  }

  const dialogOpen = picking !== null || checkingOut || unknownCode !== null;

  useEffect(() => {
    if (dialogOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === 'F2') {
        e.preventDefault();
        if (canCheckout) setCheckingOut(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialogOpen, canCheckout]);

  useBarcodeScanner(barcodeOn && !dialogOpen, (code) => {
    setQuery(''); // the scanner also "typed" into whatever had focus
    const product = active.find((p) => p.barcode === code);
    if (product) {
      cart.add(product.id!, 0);
      toast(`Added ${product.name}`);
    } else {
      setUnknownCode(code);
    }
  });

  if (products && products.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <PackageOpen size={56} className="text-stone-400" />
        <h1 className="text-2xl font-bold">No products yet</h1>
        <p className="max-w-md text-stone-600">
          Add the items you sell first. You can also load sample sari-sari products to try things out.
        </p>
        <div className="flex gap-2">
          <Link to="/products">
            <Button variant="primary" size="lg">
              Add products
            </Button>
          </Link>
          <Link to="/settings">
            <Button size="lg">Load sample data</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="space-y-3 border-b border-stone-200 bg-stone-100 px-5 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={20} className="pointer-events-none absolute inset-y-0 left-3 my-auto text-stone-400" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && visible.length === 1) {
                    pick(visible[0]);
                    setQuery('');
                  } else if (e.key === 'Escape') {
                    setQuery('');
                    e.currentTarget.blur();
                  }
                }}
                placeholder="Search products…  (press / )"
                className="w-full rounded-xl border border-stone-300 bg-white py-3 pr-3 pl-11 text-lg outline-none focus:border-red-600 focus:ring-2 focus:ring-red-200"
              />
            </div>
            {today && (
              <div className="hidden text-right text-sm leading-tight text-stone-500 xl:block">
                Today
                <div className="text-base font-bold text-stone-800">{formatPeso(today.revenue)}</div>
                {today.count} sale{today.count === 1 ? '' : 's'}
              </div>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <Chip active={category === null} onClick={() => setCategory(null)}>
              All
            </Chip>
            {categories.map((c) => (
              <Chip key={c} active={category === c} onClick={() => setCategory(category === c ? null : c)}>
                {c}
              </Chip>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {visible.length === 0 ? (
            <p className="mt-10 text-center text-stone-500">No products match “{query}”.</p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
              {visible.map((p) => {
                const low = isLowStock(p);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => pick(p)}
                    className="flex cursor-pointer flex-col overflow-hidden rounded-xl border border-stone-200 bg-white text-left transition hover:border-red-400 hover:shadow-md active:scale-[0.98]"
                  >
                    <ProductThumb product={p} className="h-20 w-full text-2xl" />
                    <div className="flex flex-1 flex-col p-2.5">
                      <span className="line-clamp-2 min-h-[2.5rem] text-sm leading-tight font-semibold">{p.name}</span>
                      <span className="mt-1 flex items-baseline justify-between gap-1">
                        <span className="font-bold text-red-700">{formatPeso(p.units[0].price)}</span>
                        {p.units.length > 1 && <span className="text-xs text-stone-500">+{p.units.length - 1} more</span>}
                      </span>
                      <span className={`mt-0.5 text-xs ${low ? 'font-semibold text-amber-700' : 'text-stone-500'}`}>
                        {low && <TriangleAlert size={12} className="mr-0.5 inline align-[-1px]" />}
                        {p.stock} {p.baseUnit} left
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <aside className="flex w-[360px] shrink-0 flex-col border-l border-stone-200 bg-white">
        <header className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <ShoppingCart size={20} /> Cart
          </h2>
          {lines.length > 0 && (
            <Button variant="ghost" size="sm" onClick={cart.clear}>
              Clear
            </Button>
          )}
        </header>

        <div className="flex-1 overflow-y-auto">
          {lines.length === 0 ? (
            <p className="px-6 py-16 text-center text-stone-500">Tap a product to add it to the cart.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {lines.map((l) => {
                const short = l.product && (needed.get(l.productId) ?? 0) > l.product.stock;
                return (
                  <li key={`${l.productId}-${l.unitIndex}`} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{l.product?.name ?? 'Removed product'}</div>
                        <div className="text-sm text-stone-500">
                          {l.unit ? `${l.unit.name} · ${formatPeso(l.unit.price)}` : 'No longer available, remove it'}
                        </div>
                      </div>
                      <div className="text-right font-bold">{l.unit ? formatPeso(l.unit.price * l.qty) : '—'}</div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="Less"
                        onClick={() => cart.setQty(l.index, l.qty - 1)}
                        className="cursor-pointer rounded-lg border border-stone-300 p-1.5 hover:bg-stone-50"
                      >
                        <Minus size={16} />
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={l.qty}
                        aria-label="Quantity"
                        onChange={(e) => {
                          const n = Math.floor(Number(e.target.value));
                          if (n >= 1) cart.setQty(l.index, n);
                        }}
                        className="w-14 rounded-lg border border-stone-300 py-1 text-center font-semibold"
                      />
                      <button
                        type="button"
                        aria-label="More"
                        onClick={() => cart.setQty(l.index, l.qty + 1)}
                        className="cursor-pointer rounded-lg border border-stone-300 p-1.5 hover:bg-stone-50"
                      >
                        <Plus size={16} />
                      </button>
                      {short && (
                        <span className="flex items-center gap-1 text-xs font-medium text-amber-700">
                          <TriangleAlert size={14} /> only {l.product!.stock} {l.product!.baseUnit} in stock
                        </span>
                      )}
                      <button
                        type="button"
                        aria-label="Remove"
                        onClick={() => cart.remove(l.index)}
                        className="ml-auto cursor-pointer rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="space-y-3 border-t border-stone-200 p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-semibold text-stone-600">Total</span>
            <span className="text-3xl font-bold">{formatPeso(total)}</span>
          </div>
          <Button variant="primary" size="lg" className="w-full" disabled={!canCheckout} onClick={() => setCheckingOut(true)}>
            Checkout <kbd className="rounded bg-red-900/50 px-1.5 text-sm font-normal">F2</kbd>
          </Button>
        </footer>
      </aside>

      {picking && (
        <Modal title={picking.name} onClose={() => setPicking(null)}>
          <p className="mb-3 text-sm text-stone-500">How is it being bought?</p>
          <div className="grid grid-cols-2 gap-3">
            {picking.units.map((u, i) => (
              <button
                key={u.name}
                type="button"
                autoFocus={i === 0}
                onClick={() => {
                  cart.add(picking.id!, i);
                  setPicking(null);
                }}
                className="cursor-pointer rounded-xl border-2 border-stone-200 p-4 text-left hover:border-red-500 hover:bg-red-50 focus-visible:border-red-500 focus-visible:outline-none"
              >
                <div className="text-lg font-bold">{u.name}</div>
                <div className="text-xl font-bold text-red-700">{formatPeso(u.price)}</div>
                {u.qtyInBase > 1 && (
                  <div className="text-xs text-stone-500">
                    {u.qtyInBase} {picking.baseUnit}
                  </div>
                )}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {checkingOut && (
        <CheckoutDialog
          lines={cart.items}
          total={total}
          onClose={() => setCheckingOut(false)}
          onDone={(sale) => {
            cart.clear();
            setCheckingOut(false);
            if (sale.payment === 'cash' && sale.change) toast(`Sale saved · Change (sukli): ${formatPeso(sale.change)}`);
            else if (sale.payment === 'utang') toast(`Sale saved · ${formatPeso(sale.total)} added to utang`);
            else toast('Sale saved');
            searchRef.current?.focus();
          }}
        />
      )}

      {unknownCode !== null && (
        <AssignBarcodeDialog
          code={unknownCode}
          products={active}
          onClose={() => setUnknownCode(null)}
          onAssigned={(product) => {
            setUnknownCode(null);
            cart.add(product.id!, 0);
            toast(`Barcode saved · Added ${product.name}`);
          }}
        />
      )}
    </div>
  );
}
