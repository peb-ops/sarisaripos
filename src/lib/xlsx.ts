import writeXlsxFile from 'write-excel-file/universal';
import type { Cell } from 'write-excel-file/universal';
import type { CellValue, Column, Table } from './exportData';

// Loaded on demand (dynamic import) so the Excel writer isn't part of app startup.

const FORMAT: Record<Exclude<Column['type'], 'text'>, string> = {
  money: '"₱"#,##0.00',
  number: '#,##0',
  datetime: 'yyyy-mm-dd hh:mm',
};

function toCell(value: CellValue, column: Column): Cell {
  if (value === null) return null;
  if (value instanceof Date) return { value, type: Date, format: FORMAT.datetime };
  if (typeof value === 'number') return { value, type: Number, format: column.type === 'text' ? undefined : FORMAT[column.type] };
  return { value, type: String };
}

/** One .xlsx with a sheet per table, bold frozen header row. */
export function toXlsx(tables: Table[]): Promise<Blob> {
  return writeXlsxFile(
    tables.map((t) => ({
      sheet: t.name,
      data: [
        t.columns.map((c) => ({ value: c.header, fontWeight: 'bold' as const })),
        ...t.rows.map((row) => row.map((v, i) => toCell(v, t.columns[i]))),
      ],
      columns: t.columns.map((c) => ({ width: c.width ?? 14 })),
      stickyRowsCount: 1,
    })),
  ).toBlob();
}
