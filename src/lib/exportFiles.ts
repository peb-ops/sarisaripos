import { toCsv } from './csv';
import { downloadBlob } from './download';
import { collectTables, type ExportKind, type Table } from './exportData';

export interface ExportOptions {
  /** Only include sales from this time on. */
  since?: number;
  /** Added to the file name, e.g. "last-7-days". */
  label?: string;
  /** For CSV: export only this table (by name) instead of all of the kind's tables. */
  table?: string;
}

function baseName(kind: ExportKind, label?: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return ['sari-sari', kind === 'all' ? 'all-data' : kind, label, today].filter(Boolean).join('-');
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export async function exportExcel(kind: ExportKind, opts: ExportOptions = {}): Promise<void> {
  const [tables, { toXlsx }] = await Promise.all([collectTables(kind, opts.since), import('./xlsx')]);
  downloadBlob(await toXlsx(tables), `${baseName(kind, opts.label)}.xlsx`);
}

/** One table → one .csv file; several → a .zip with one .csv per table. */
export async function exportCsv(kind: ExportKind, opts: ExportOptions = {}): Promise<void> {
  let tables: Table[] = await collectTables(kind, opts.since);
  if (opts.table) tables = tables.filter((t) => t.name === opts.table);
  const name = baseName(kind, opts.label);

  if (tables.length === 1) {
    const file = opts.table && kind !== 'products' ? `${name}-${slug(tables[0].name)}.csv` : `${name}.csv`;
    downloadBlob(new Blob([toCsv(tables[0])], { type: 'text/csv;charset=utf-8' }), file);
    return;
  }

  const { zipSync, strToU8 } = await import('fflate');
  const files = Object.fromEntries(tables.map((t) => [`${slug(t.name)}.csv`, strToU8(toCsv(t))]));
  downloadBlob(new Blob([zipSync(files)], { type: 'application/zip' }), `${name}-csv.zip`);
}
