import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addCigarettes, resetDb } from '../test/helpers';
import { createAutoBackup } from './autoBackup';
import { parseBackup } from './backup';

beforeEach(resetDb);

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('auto backup', () => {
  it('debounces bursts of changes into one full backup', async () => {
    await addCigarettes(12);
    const send = vi.fn().mockResolvedValue({ folder: 'C:\\backups' });
    const auto = createAutoBackup(send, 10);

    auto.schedule();
    auto.schedule();
    auto.schedule();
    await wait(80);

    expect(send).toHaveBeenCalledTimes(1);
    const backup = parseBackup(send.mock.calls[0][0]);
    expect(backup.data.products).toHaveLength(1);
    expect(auto.getStatus()).toMatchObject({ available: true, folder: 'C:\\backups' });
    expect(auto.getStatus().savedAt).toBe(backup.exportedAt);
  });

  it('turns itself off when the server cannot store backups', async () => {
    const send = vi.fn().mockResolvedValue(null);
    const auto = createAutoBackup(send, 10);
    await auto.runNow();
    auto.schedule();
    await wait(50);
    expect(send).toHaveBeenCalledTimes(1);
    expect(auto.getStatus().available).toBe(false);
  });

  it('keeps going after a failed send and notifies listeners', async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error('busy')).mockResolvedValue({});
    const auto = createAutoBackup(send, 10);
    const listener = vi.fn();
    auto.subscribe(listener);

    await auto.runNow();
    expect(auto.getStatus().available).toBeNull();
    await auto.runNow();
    expect(auto.getStatus().available).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
