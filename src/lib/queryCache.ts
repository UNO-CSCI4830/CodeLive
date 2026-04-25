/**
 * queryCache — lightweight in-memory stale-while-revalidate cache.
 *
 * Stores fetch results so pages render instantly on revisit while a
 * background refresh keeps data fresh.  The cache lives for the
 * lifetime of the SPA — a full page reload clears it automatically.
 */

const store = new Map<string, unknown>();

/** Return cached data for `key`, or undefined if nothing stored. */
export function getCached<T>(key: string): T | undefined {
  return store.get(key) as T | undefined;
}

/** Store data under `key`. */
export function setCache(key: string, data: unknown): void {
  store.set(key, data);
}

/** Remove one key, or clear everything if no key given. */
export function clearCache(key?: string): void {
  if (key) store.delete(key);
  else store.clear();
}
