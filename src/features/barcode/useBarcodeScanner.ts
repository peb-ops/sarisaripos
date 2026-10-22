import { useEffect, useRef } from 'react';
import { createScanDetector } from './scanDetector';

/** Listens for scanner input anywhere on the page while enabled. */
export function useBarcodeScanner(enabled: boolean, onScan: (code: string) => void) {
  const callback = useRef(onScan);
  callback.current = onScan;

  useEffect(() => {
    if (!enabled) return;
    const detect = createScanDetector((code) => callback.current(code));
    const handler = (e: KeyboardEvent) => {
      // Capture phase + stopPropagation: the Enter that ends a scan must not
      // also reach the focused input (e.g. the search box's own Enter handler).
      if (detect(e)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [enabled]);
}
