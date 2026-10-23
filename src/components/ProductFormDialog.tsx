import { ImagePlus, Plus, Trash2 } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import type { Product } from '../db/schema';
import { BarcodeField } from '../features/barcode/BarcodeField';
import { resizeImage } from '../lib/image';
import { saveProduct } from '../lib/inventory';
import { formatPeso, parsePeso, pesoInputValue } from '../lib/money';
import { Modal } from './Modal';
import { ProductThumb } from './ProductThumb';
import { Button, ErrorText, Field, Input, PesoInput, errorMessage } from './ui';

const BASE_UNITS = ['piece', 'pack', 'sachet', 'stick', 'can', 'bottle', 'bar', 'pouch', 'cup', '¼ kg'];

interface UnitRow {
  name: string;
  qtyInBase: string;
  price: string;
}

export function ProductFormDialog({
  product,
  categories,
  suppliers,
  onClose,
  onSaved,
}: {
  product?: Product;
  categories: string[];
  suppliers: string[];
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const initialCost = product ? pesoInputValue(product.costPerBase) : '';
  const [name, setName] = useState(product?.name ?? '');
  const [category, setCategory] = useState(product?.category ?? '');
  const [baseUnit, setBaseUnit] = useState(product?.baseUnit ?? 'piece');
  const [cost, setCost] = useState(initialCost);
  const [lowStockAt, setLowStockAt] = useState(String(product?.lowStockAt ?? 5));
  const [openingStock, setOpeningStock] = useState('');
  const [barcode, setBarcode] = useState(product?.barcode ?? '');
  const [supplier, setSupplier] = useState(product?.supplier ?? '');
  const [image, setImage] = useState(product?.image);
  const [active, setActive] = useState(product?.active ?? true);
  const [units, setUnits] = useState<UnitRow[]>(
    product?.units.map((u) => ({ name: u.name, qtyInBase: String(u.qtyInBase), price: pesoInputValue(u.price) })) ?? [
      { name: '', qtyInBase: '1', price: '' },
    ],
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const costValue = parsePeso(cost);

  function updateUnit(i: number, patch: Partial<UnitRow>) {
    setUnits((cur) => cur.map((u, j) => (j === i ? { ...u, ...patch } : u)));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');

    const parsedUnits = units.map((u, i) => ({
      // The first unit defaults to the base unit name if left blank.
      name: u.name.trim() || (i === 0 ? baseUnit : ''),
      qtyInBase: Number(u.qtyInBase),
      price: parsePeso(u.price),
    }));
    if (parsedUnits.some((u) => u.price === null)) return setError('Enter a valid price for every selling unit.');
    if (cost.trim() && costValue === null) return setError('Cost is not a valid amount.');
    const stock = openingStock.trim() ? Number(openingStock) : 0;
    if (!Number.isInteger(stock)) return setError('Starting stock must be a whole number.');

    // Keep the exact stored cost unless the owner changed it (it can be fractional, e.g. ₱8.333).
    const costPerBase = product && cost === initialCost ? product.costPerBase : costValue ?? 0;

    setSaving(true);
    try {
      await saveProduct(
        {
          name,
          category,
          baseUnit,
          costPerBase,
          lowStockAt: Number(lowStockAt),
          units: parsedUnits.map((u) => ({ ...u, price: u.price! })),
          barcode,
          supplier,
          image,
          active,
        },
        product?.id,
        stock,
      );
      onSaved(name.trim());
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal
      title={product ? `Edit ${product.name}` : 'Add product'}
      onClose={onClose}
      wide
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="product-form" disabled={saving}>
            Save product
          </Button>
        </>
      }
    >
      <form id="product-form" onSubmit={submit} className="space-y-5">
        <div className="flex gap-4">
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="group relative block size-24 cursor-pointer overflow-hidden rounded-xl border border-stone-200"
              aria-label="Add photo"
            >
              {image || name ? (
                <ProductThumb product={{ name: name || '?', category, image }} className="size-full text-2xl" />
              ) : (
                <span className="flex size-full items-center justify-center bg-stone-50 text-stone-400">
                  <ImagePlus />
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 bg-black/50 py-0.5 text-center text-xs text-white opacity-0 group-hover:opacity-100">
                {image ? 'Change' : 'Add photo'}
              </span>
            </button>
            {image && (
              <button type="button" onClick={() => setImage(undefined)} className="mt-1 w-full cursor-pointer text-xs text-stone-500 hover:text-red-700">
                Remove photo
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                try {
                  setImage(await resizeImage(file));
                } catch (err) {
                  setError(errorMessage(err));
                }
              }}
            />
          </div>
          <div className="grid flex-1 grid-cols-2 gap-3">
            <Field label="Product name" className="col-span-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Lucky Me Pancit Canton" />
            </Field>
            <Field label="Category">
              <Input value={category} onChange={(e) => setCategory(e.target.value)} list="categories" placeholder="e.g. Noodles" />
              <datalist id="categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label="Counted in (base unit)" hint="The smallest unit you sell or count.">
              <Input value={baseUnit} onChange={(e) => setBaseUnit(e.target.value)} list="base-units" />
              <datalist id="base-units">
                {BASE_UNITS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </Field>
          </div>
        </div>

        <fieldset className="rounded-xl border border-stone-200 p-4">
          <legend className="px-1 font-semibold">How it's sold</legend>
          <p className="mb-3 text-sm text-stone-500">
            Add more rows for tingi or bulk, e.g. cigarettes by <em>stick</em> (1) and by <em>pack</em> (20).
          </p>
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_8rem_9rem_7rem_2rem] gap-2 text-xs font-medium text-stone-500">
              <span>Sell as</span>
              <span>Contains ({baseUnit || 'base'})</span>
              <span>Price</span>
              <span className="text-right">Profit each</span>
              <span />
            </div>
            {units.map((u, i) => {
              const price = parsePeso(u.price);
              const qty = Number(u.qtyInBase);
              const profit = price !== null && costValue !== null && qty > 0 ? price - costValue * qty : null;
              return (
                <div key={i} className="grid grid-cols-[1fr_8rem_9rem_7rem_2rem] items-center gap-2">
                  <Input
                    value={u.name}
                    onChange={(e) => updateUnit(i, { name: e.target.value })}
                    placeholder={i === 0 ? baseUnit : 'e.g. pack'}
                    aria-label="Sell as"
                  />
                  <Input
                    type="number"
                    min={1}
                    value={u.qtyInBase}
                    onChange={(e) => updateUnit(i, { qtyInBase: e.target.value })}
                    aria-label="Contains"
                  />
                  <PesoInput value={u.price} onChange={(e) => updateUnit(i, { price: e.target.value })} aria-label="Price" />
                  <span className={`text-right text-sm ${profit !== null && profit < 0 ? 'font-semibold text-red-700' : 'text-stone-600'}`}>
                    {profit === null ? '—' : formatPeso(profit)}
                  </span>
                  <button
                    type="button"
                    disabled={units.length === 1}
                    onClick={() => setUnits((cur) => cur.filter((_, j) => j !== i))}
                    aria-label="Remove row"
                    className="cursor-pointer rounded-lg p-1 text-stone-400 hover:text-red-700 disabled:invisible"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              );
            })}
          </div>
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => setUnits((cur) => [...cur, { name: '', qtyInBase: '', price: '' }])}>
            <Plus size={16} /> Add another way to sell
          </Button>
        </fieldset>

        <div className="grid grid-cols-3 gap-3">
          <Field label={`Your cost per ${baseUnit || 'unit'}`} hint="What you paid. Restocking averages in the new price.">
            <PesoInput value={cost} onChange={(e) => setCost(e.target.value)} />
          </Field>
          <Field label="Warn when stock is at or below">
            <Input type="number" min={0} value={lowStockAt} onChange={(e) => setLowStockAt(e.target.value)} />
          </Field>
          {product ? (
            <Field label="Stock" hint="Use the Stock button to restock or correct the count.">
              <Input value={`${product.stock} ${product.baseUnit}`} disabled />
            </Field>
          ) : (
            <Field label={`Starting stock (${baseUnit || 'units'})`}>
              <Input type="number" min={0} value={openingStock} onChange={(e) => setOpeningStock(e.target.value)} placeholder="0" />
            </Field>
          )}
        </div>

        <Field label="Supplier (optional)" hint="Where you buy it. The buying list groups items by supplier.">
          <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} list="suppliers" placeholder="e.g. Puregold, Alfamart, ahente" />
          <datalist id="suppliers">
            {suppliers.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>

        <BarcodeField value={barcode} onChange={setBarcode} />

        {product && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4 accent-red-700" />
            <span>
              Show on the Sell screen <span className="text-sm text-stone-500">(uncheck to archive; sales history is kept)</span>
            </span>
          </label>
        )}

        <ErrorText>{error}</ErrorText>
      </form>
    </Modal>
  );
}
