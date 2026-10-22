import type { Product } from '../db/schema';

const COLORS = [
  'bg-red-100 text-red-800',
  'bg-amber-100 text-amber-800',
  'bg-emerald-100 text-emerald-800',
  'bg-sky-100 text-sky-800',
  'bg-violet-100 text-violet-800',
  'bg-pink-100 text-pink-800',
  'bg-lime-100 text-lime-800',
  'bg-orange-100 text-orange-800',
];

function colorFor(text: string): string {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

/** Product photo, or a colored block with initials (color by category). */
export function ProductThumb({ product, className = '' }: { product: Pick<Product, 'name' | 'category' | 'image'>; className?: string }) {
  if (product.image) {
    return <img src={product.image} alt="" className={`object-cover ${className}`} />;
  }
  return (
    <div aria-hidden className={`flex items-center justify-center font-bold ${colorFor(product.category)} ${className}`}>
      {initials(product.name)}
    </div>
  );
}
