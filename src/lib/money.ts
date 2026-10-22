const formatter = new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 12345 → "₱123.45", -500 → "-₱5.00". */
export function formatPeso(centavos: number): string {
  const rounded = Math.round(centavos);
  const sign = rounded < 0 ? '-' : '';
  return `${sign}₱${formatter.format(Math.abs(rounded) / 100)}`;
}

/**
 * Parses what the owner types ("45", "45.5", "₱1,200.00") into centavos.
 * Returns null for anything that isn't a non-negative amount with ≤2 decimals.
 */
export function parsePeso(input: string): number | null {
  const cleaned = input.replace(/[₱,\s]/g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned) && !/^\.\d{1,2}$/.test(cleaned)) return null;
  const [whole, frac = ''] = cleaned.split('.');
  return Number(whole || '0') * 100 + Number(frac.padEnd(2, '0'));
}

/** Centavos → plain editable string ("1200.5" style without symbol), for form inputs. */
export function pesoInputValue(centavos: number): string {
  const rounded = Math.round(centavos);
  return rounded % 100 === 0 ? String(rounded / 100) : (rounded / 100).toFixed(2);
}
