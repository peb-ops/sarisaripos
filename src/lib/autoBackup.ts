import Dexie from 'dexie';
import { exportBackup } from './backup';

// When the app runs from the installed launcher, the local server can save
// files. Shortly after any change the app sends it a full backup, so a
// recent copy of the records always exists on disk (the updater copies it
// before installing anything). Under `npm run dev`/preview there is no
// such endpoint and this quietly turns itself off.

export interface AutoBackupStatus {
  /** null = not known yet, false = not available (no local server). */
  available: boolean | null;
  savedAt?: number;
  folder?: string;
}

/** Sends backup JSON; resolves null if the server can't store backups. */
export type SendBackup = (json: string) => Promise<{ folder?: string } | null>;

export function createAutoBackup(send: SendBackup, delayMs = 3000) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let again = false;
  let disabled = false;
  let status: AutoBackupStatus = { available: null };
  const listeners = new Set<() => void>();

  function setStatus(next: AutoBackupStatus) {
    status = next;
    listeners.forEach((l) => l());
  }

  async function run() {
    timer = undefined;
    if (disabled) return;
    if (running) {
      again = true;
      return;
    }
    running = true;
    try {
      const backup = await exportBackup();
      const result = await send(JSON.stringify(backup));
      if (result === null) {
        disabled = true;
        setStatus({ available: false });
      } else {
        setStatus({ available: true, savedAt: backup.exportedAt, folder: result.folder });
      }
    } catch {
      // Server busy or the window is closing; the next change retries.
    } finally {
      running = false;
      if (again) {
        again = false;
        schedule();
      }
    }
  }

  function schedule() {
    if (disabled) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(run, delayMs);
  }

  return {
    schedule,
    runNow: run,
    getStatus: () => status,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

async function postToLocalServer(json: string): Promise<{ folder?: string } | null> {
  const res = await fetch('/api/backup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-SariSari-POS': '1' },
    body: json,
  });
  if (!res.headers.get('content-type')?.includes('application/json')) return null; // not our server
  if (!res.ok) throw new Error(`Backup failed (${res.status})`);
  return res.json();
}

export const autoBackup = createAutoBackup(postToLocalServer);

export function startAutoBackup() {
  Dexie.on('storagemutated', () => autoBackup.schedule());
  setTimeout(() => void autoBackup.runNow(), 2000);
}
