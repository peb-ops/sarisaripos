// USB/Bluetooth barcode scanners behave like a keyboard ("keyboard wedge"):
// they type the code very fast and press Enter. A human can't type that fast,
// so a burst of keys with tiny gaps followed by Enter is treated as a scan.

export interface ScanDetectorOptions {
  /** Max milliseconds between keys for them to count as one scan. */
  maxGapMs?: number;
  minLength?: number;
}

export interface KeyLike {
  key: string;
  timeStamp: number;
}

/** Returns a key handler; it returns true when the key completed a scan. */
export function createScanDetector(onScan: (code: string) => void, opts: ScanDetectorOptions = {}) {
  const { maxGapMs = 50, minLength = 4 } = opts;
  let buffer = '';
  let lastTime = -Infinity;

  return (e: KeyLike): boolean => {
    const gap = e.timeStamp - lastTime;

    if (e.key === 'Enter') {
      const code = buffer;
      buffer = '';
      lastTime = -Infinity;
      if (code.length >= minLength && gap <= maxGapMs) {
        onScan(code);
        return true;
      }
      return false;
    }

    // Ignore Shift/Control/etc. (scanners press Shift for capitals).
    if (e.key.length !== 1) return false;

    buffer = gap <= maxGapMs ? buffer + e.key : e.key;
    lastTime = e.timeStamp;
    return false;
  };
}
