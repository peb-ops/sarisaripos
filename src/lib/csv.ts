import type { CellValue, ColumnType, Table } from './exportData';

/** "2026-10-22 15:05" in local time; Excel reads this as a date. */
function csvDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function csvCell(value: CellValue, type: ColumnType): string {
  if (value === null) return '';
  let s: string;
  if (value instanceof Date) s = csvDate(value);
  else if (typeof value === 'number') s = type === 'money' ? value.toFixed(2) : String(value);
  else {
    // Text starting like a formula (=, +, -, @) would run as one in Excel.
    s = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  }
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * CSV with a UTF-8 byte-order mark and Windows line endings, which is
 * what Excel needs to show ₱ and ñ correctly when the file is double-clicked.
 */
export function toCsv(table: Table): string {
  const header = table.columns.map((c) => csvCell(c.header, 'text'));
  const rows = table.rows.map((row) => row.map((v, i) => csvCell(v, table.columns[i].type)));
  return '﻿' + [header, ...rows].map((r) => r.join(',')).join('\r\n') + '\r\n';
}
