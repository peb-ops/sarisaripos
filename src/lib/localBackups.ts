import { autoBackup } from './autoBackup';
import { exportBackup, parseBackup, restoreBackup, type Backup } from './backup';

// Backups the installed launcher keeps on disk (see launcher/system/server.ps1),
// listed so the owner can restore one without opening any folder.

export type LocalBackupKind = 'auto' | 'before-update' | 'before-restore';

export interface LocalBackup {
  id: string;
  kind: LocalBackupKind;
  /** When the file was last written (ms). */
  modified: number;
  size: number;
}

const HEADERS = { 'X-SariSari-POS': '1' };

function isJson(res: Response) {
  return res.headers.get('content-type')?.includes('application/json') ?? false;
}

/** null when not running from the installed launcher (or an older one). */
export async function listLocalBackups(): Promise<LocalBackup[] | null> {
  const res = await fetch('/api/backups', { headers: HEADERS });
  if (!res.ok || !isJson(res)) return null;
  return ((await res.json()) as { backups: LocalBackup[] }).backups;
}

export async function fetchLocalBackup(id: string): Promise<Backup> {
  const res = await fetch(`/api/backups/file?id=${encodeURIComponent(id)}`, { headers: HEADERS });
  if (!res.ok) throw new Error('Could not open that backup.');
  return parseBackup(await res.text());
}

/**
 * Restores a backup, first saving the current records as a "before restore"
 * backup on disk (when the launcher can store one), so a wrong choice can be
 * undone from the same list.
 */
export async function restoreWithSafetyCopy(backup: Backup): Promise<void> {
  // Try unless we already know there's no launcher (status is unknown for
  // the first seconds after opening the app).
  if (autoBackup.getStatus().available !== false) {
    const failed = new Error('Could not save a copy of your current records, so nothing was restored.');
    const res = await fetch('/api/backup?kind=before-restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...HEADERS },
      body: JSON.stringify(await exportBackup()),
    }).catch(() => {
      throw failed;
    });
    // A non-JSON reply means no launcher (e.g. npm run dev): nowhere to save.
    if (isJson(res) && !res.ok) throw failed;
  }
  await restoreBackup(backup);
}
