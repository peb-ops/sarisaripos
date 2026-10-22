import { ScanBarcode } from 'lucide-react';
import { useFlag } from '../../hooks';
import { Field, Input } from '../../components/ui';

/** Barcode input for the product form. Renders nothing unless the barcode flag is on. */
export function BarcodeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const enabled = useFlag('barcode');
  if (!enabled) return null;
  return (
    <Field label="Barcode" hint="Click here and scan the product, or type the number.">
      <div className="relative">
        <ScanBarcode size={18} className="pointer-events-none absolute inset-y-0 left-3 my-auto text-stone-400" />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          // Scanners press Enter after the code; don't let that submit the form.
          onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
          className="pl-9 font-mono"
          autoComplete="off"
        />
      </div>
    </Field>
  );
}
