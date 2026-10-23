import { useLiveQuery } from 'dexie-react-hooks';
import { useSyncExternalStore } from 'react';
import { db } from './db/schema';
import { autoBackup } from './lib/autoBackup';
import { DEFAULT_FLAGS, getFlags, type FlagName } from './lib/featureFlags';
import { getAllBalances } from './lib/ledger';
import { getFees, walletBalances } from './lib/services';
import { getSetting } from './lib/settings';

export function useSetting<T>(key: string, fallback: T): T {
  return (useLiveQuery(() => getSetting(key, fallback), [key]) ?? fallback) as T;
}

export function useFlag(name: FlagName): boolean {
  return useLiveQuery(getFlags, [])?.[name] ?? DEFAULT_FLAGS[name];
}

/** All products (including archived), sorted by name. undefined while loading. */
export function useProducts() {
  return useLiveQuery(() => db.products.orderBy('name').toArray(), []);
}

export function useCustomers() {
  return useLiveQuery(() => db.customers.orderBy('name').toArray(), []);
}

export function useBalances() {
  return useLiveQuery(getAllBalances, []);
}

export function useAutoBackupStatus() {
  return useSyncExternalStore(autoBackup.subscribe, autoBackup.getStatus);
}

export function useServiceFees() {
  return useLiveQuery(getFees, []);
}

export function useWalletBalances() {
  return useLiveQuery(walletBalances, []);
}
