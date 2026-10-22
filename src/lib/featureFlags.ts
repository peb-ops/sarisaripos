import { getSetting, setSetting } from './settings';

// Features that are built but not ready to show. There is deliberately no
// toggle in the Settings UI; enable with ?flags=barcode (or ?flags=-barcode
// to turn off). The choice is saved, so it survives reloads.

export type FlagName = 'barcode';
export type Flags = Record<FlagName, boolean>;

export const DEFAULT_FLAGS: Flags = { barcode: false };

const KEY = 'flags';

export async function getFlags(): Promise<Flags> {
  return { ...DEFAULT_FLAGS, ...(await getSetting<Partial<Flags>>(KEY, {})) };
}

export async function setFlag(name: FlagName, on: boolean): Promise<void> {
  await setSetting(KEY, { ...(await getFlags()), [name]: on });
}

export function parseFlagParam(search: string): Partial<Flags> {
  const raw = new URLSearchParams(search).get('flags');
  const out: Partial<Flags> = {};
  if (!raw) return out;
  for (const part of raw.split(',')) {
    const token = part.trim();
    const off = token.startsWith('-');
    const name = off ? token.slice(1) : token;
    if (name in DEFAULT_FLAGS) out[name as FlagName] = !off;
  }
  return out;
}

export async function applyUrlFlags(search: string): Promise<void> {
  const changes = parseFlagParam(search);
  if (Object.keys(changes).length === 0) return;
  await setSetting(KEY, { ...(await getFlags()), ...changes });
}
