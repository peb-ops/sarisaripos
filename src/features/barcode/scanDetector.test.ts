import { describe, expect, it, vi } from 'vitest';
import { parseFlagParam } from '../../lib/featureFlags';
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

describe('feature flag URL param', () => {
  it('parses on/off and ignores unknown flags', () => {
    expect(parseFlagParam('?flags=barcode')).toEqual({ barcode: true });
    expect(parseFlagParam('?flags=-barcode,unknown')).toEqual({ barcode: false });
    expect(parseFlagParam('')).toEqual({});
  });
});
