import { db } from '../db/schema';

export class BackupError extends Error {}

const TABLES = ['products', 'customers', 'sales', 'ledger', 'stockMoves', 'settings'] as const;
type TableName = (typeof TABLES)[number];

export interface Backup {
  app: 'sari-sari-pos';
  version: 1;
  exportedAt: number;
  data: Record<TableName, unknown[]>;
}

export async function exportBackup(now = Date.now()): Promise<Backup> {
  const data = {} as Backup['data'];
  await db.transaction('r', db.tables, async () => {
    for (const name of TABLES) data[name] = await db.table(name).toArray();
  });
  return { app: 'sari-sari-pos', version: 1, exportedAt: now, data };
}

export function parseBackup(json: string): Backup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new BackupError('This file is not a valid backup (could not read JSON).');
  }
  const b = parsed as Partial<Backup>;
  if (b?.app !== 'sari-sari-pos' || b.version !== 1 || typeof b.data !== 'object' || b.data === null)
    throw new BackupError('This file is not a Sari-Sari POS backup.');
  for (const name of TABLES) {
    if (!Array.isArray(b.data[name])) throw new BackupError(`Backup is missing "${name}".`);
  }
  return b as Backup;
}

/** Replaces ALL current data with the backup's contents. */
export async function restoreBackup(backup: Backup): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const name of TABLES) {
      const table = db.table(name);
      await table.clear();
      await table.bulkAdd(backup.data[name]);
    }
  });
}

export function downloadJson(value: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(value)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
