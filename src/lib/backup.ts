import { db } from '../db/schema';
import { downloadBlob } from './download';

export class BackupError extends Error {}

const TABLES = ['products', 'customers', 'sales', 'ledger', 'stockMoves', 'services', 'walletMoves', 'settings'] as const;
type TableName = (typeof TABLES)[number];

/** Tables added after backup version 1; older backups simply don't have them. */
const ADDED_IN_V2: TableName[] = ['services', 'walletMoves'];

export const BACKUP_VERSION = 2;

export interface Backup {
  app: 'sari-sari-pos';
  version: typeof BACKUP_VERSION;
  exportedAt: number;
  data: Record<TableName, unknown[]>;
}

export async function exportBackup(now = Date.now()): Promise<Backup> {
  const data = {} as Backup['data'];
  await db.transaction('r', db.tables, async () => {
    for (const name of TABLES) data[name] = await db.table(name).toArray();
  });
  return { app: 'sari-sari-pos', version: BACKUP_VERSION, exportedAt: now, data };
}

export function parseBackup(json: string): Backup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new BackupError('This file is not a valid backup (could not read JSON).');
  }
  const b = parsed as { app?: unknown; version?: unknown; exportedAt?: number; data?: Partial<Backup['data']> } | null;
  if (b?.app !== 'sari-sari-pos' || typeof b.data !== 'object' || b.data === null)
    throw new BackupError('This file is not a Sari-Sari POS backup.');
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION)
    throw new BackupError('This backup is from a newer version of Sari-Sari POS. Update the app first.');
  const data = { ...b.data };
  if (b.version < 2) for (const name of ADDED_IN_V2) data[name] ??= [];
  for (const name of TABLES) {
    if (!Array.isArray(data[name])) throw new BackupError(`Backup is missing "${name}".`);
  }
  return { app: 'sari-sari-pos', version: BACKUP_VERSION, exportedAt: b.exportedAt ?? 0, data: data as Backup['data'] };
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
  downloadBlob(new Blob([JSON.stringify(value)], { type: 'application/json' }), filename);
}
