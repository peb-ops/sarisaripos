import { describe, expect, it, vi } from 'vitest';
import { getFlags, setFlag } from '../../lib/featureFlags';
import { resetDb } from '../../test/helpers';
import { createScanDetector } from './scanDetector';

function type(detect: ReturnType<typeof createScanDetector>, text: string, start: number, gapMs: number) {
  let t = start;
  for (const key of [...text, 'Enter']) {
    detect({ key, timeStamp: t });
    t += gapMs;
  }
}

describe('scan detector', () => {
  it('detects fast bursts ending in Enter', () => {
    const onScan = vi.fn();
    const detect = createScanDetector(onScan);
    type(detect, '4800016644702', 0, 10);
    expect(onScan).toHaveBeenCalledWith('4800016644702');
  });

  it('ignores human typing speed', () => {
    const onScan = vi.fn();
    const detect = createScanDetector(onScan);
    type(detect, 'coke', 0, 150);
    expect(onScan).not.toHaveBeenCalled();
  });

  it('ignores modifier keys and short codes', () => {
    const onScan = vi.fn();
    const detect = createScanDetector(onScan);
    detect({ key: 'Shift', timeStamp: 0 });
    type(detect, 'AB12', 5, 5);
    expect(onScan).toHaveBeenCalledWith('AB12');
    type(detect, 'ab', 1000, 5);
    expect(onScan).toHaveBeenCalledTimes(1);
  });
});

describe('barcode setting', () => {
  it('is off by default and can be switched on and off', async () => {
    await resetDb();
    expect((await getFlags()).barcode).toBe(false);
    await setFlag('barcode', true);
    expect((await getFlags()).barcode).toBe(true);
    await setFlag('barcode', false);
    expect((await getFlags()).barcode).toBe(false);
  });
});
