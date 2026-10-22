import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { ProductThumb } from '../../components/ProductThumb';
import { ErrorText, Input, errorMessage } from '../../components/ui';
import type { Product } from '../../db/schema';
import { saveProduct } from '../../lib/inventory';

/** Shown when a scanned barcode matches no product: pick which product it belongs to. */
export function AssignBarcodeDialog({
  code,
  products,
  onClose,
  onAssigned,
}: {
  code: string;
  products: Product[];
  onClose: () => void;
  onAssigned: (product: Product) => void;
}) {
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const q = search.trim().toLowerCase();
  const matches = products.filter((p) => !q || p.name.toLowerCase().includes(q)).slice(0, 30);

  async function assign(p: Product) {
    try {
      const { id, stock: _stock, createdAt: _createdAt, ...input } = p;
      await saveProduct({ ...input, barcode: code }, id);
      onAssigned({ ...p, barcode: code });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Modal title="Unknown barcode" onClose={onClose}>
      <p className="mb-3 text-stone-600">
        No product has barcode <code className="rounded bg-stone-100 px-1.5 font-mono">{code}</code>. Which product is it?
      </p>
      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products…" autoFocus />
      <ul className="mt-3 max-h-72 divide-y divide-stone-100 overflow-y-auto rounded-xl border border-stone-200">
        {matches.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => assign(p)}
              className="flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left hover:bg-stone-50"
            >
              <ProductThumb product={p} className="size-9 rounded-md text-xs" />
              <span className="flex-1">{p.name}</span>
              {p.barcode && <span className="text-xs text-amber-700">replaces {p.barcode}</span>}
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3">
        <ErrorText>{error}</ErrorText>
      </div>
    </Modal>
  );
}
