import { ChevronDown, FileDown, FileSpreadsheet, FolderArchive } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { exportCsv, exportExcel } from '../lib/exportFiles';
import { useToast } from './Toast';
import { Button, errorMessage } from './ui';

export interface ExportItem {
  label: string;
  format: 'excel' | 'csv';
  run: () => Promise<void>;
}

/** "Export ▾" menu: this screen's exports, plus "Export all" at the bottom. */
export function ExportMenu({ items, align = 'right' }: { items: ExportItem[]; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', close);
    };
  }, [open]);

  async function run(item: ExportItem) {
    setOpen(false);
    setBusy(true);
    try {
      await item.run();
      toast('Exported: the file is in your Downloads folder');
    } catch (err) {
      toast(`Export failed: ${errorMessage(err)}`, 'error');
    } finally {
      setBusy(false);
    }
  }

  const all: ExportItem[] = [
    { label: 'Everything (Excel)', format: 'excel', run: () => exportExcel('all') },
    { label: 'Everything (CSV files, zipped)', format: 'csv', run: () => exportCsv('all') },
  ];

  const row = (item: ExportItem) => (
    <button
      key={item.label}
      type="button"
      role="menuitem"
      onClick={() => run(item)}
      className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm hover:bg-stone-100"
    >
      {item.format === 'excel' ? (
        <FileSpreadsheet size={16} className="shrink-0 text-emerald-700" />
      ) : item.label.includes('zipped') ? (
        <FolderArchive size={16} className="shrink-0 text-stone-500" />
      ) : (
        <FileDown size={16} className="shrink-0 text-stone-500" />
      )}
      {item.label}
    </button>
  );

  return (
    <div ref={ref} className="relative">
      <Button size="sm" onClick={() => setOpen((o) => !o)} disabled={busy} aria-haspopup="menu" aria-expanded={open}>
        <FileDown size={16} /> {busy ? 'Exporting…' : 'Export'} <ChevronDown size={14} />
      </Button>
      {open && (
        <div
          role="menu"
          className={`absolute top-full z-30 mt-1 w-64 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-lg ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {items.map(row)}
          <div className="mt-1 border-t border-stone-100 px-3 pt-2 pb-1 text-xs font-semibold tracking-wide text-stone-400 uppercase">
            Export all
          </div>
          {all.map(row)}
        </div>
      )}
    </div>
  );
}
