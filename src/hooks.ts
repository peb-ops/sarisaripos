import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db/schema';
import { DEFAULT_FLAGS, getFlags, type FlagName } from './lib/featureFlags';
import { getAllBalances } from './lib/ledger';
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
