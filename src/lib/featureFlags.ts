import { getSetting, setSetting } from './settings';

// Optional features the owner can switch on in Settings.

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
