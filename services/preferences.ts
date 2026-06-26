/**
 * @file preferences.ts
 * @description Durable per-user preferences, backed by Django's /memory/ store
 * (see `api.memory`) with a localStorage cache. The cache lets the UI render an
 * instant value on first paint and keeps prefs working while logged-out/offline;
 * the server copy is the source of truth and follows the user across devices.
 *
 * Pattern: read `getCachedPreference` synchronously for initial state, then call
 * `loadPreference` to reconcile with the server, and `savePreference` on change.
 */

import { api } from './api';

/** Namespacing prefix so cached prefs never collide with other localStorage keys. */
const CACHE_PREFIX = 'pref:';

/** Synchronous best-effort read from the localStorage cache (for first render). */
export function getCachedPreference<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

/** Best-effort write to the localStorage cache. */
function writeCache(key: string, value: any): void {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value));
  } catch {
    /* private mode / quota — ignore, server copy still persists */
  }
}

/**
 * Reconciles a preference with the server: returns the server value when present
 * (and refreshes the cache), otherwise the cached/fallback value. Safe to call
 * when logged out — it simply returns the local value.
 */
export async function loadPreference<T>(key: string, fallback: T): Promise<T> {
  try {
    const server = await api.memory.get<T>(key);
    if (server !== null && server !== undefined) {
      writeCache(key, server);
      return server;
    }
  } catch {
    /* fall through to local cache on any network/auth error */
  }
  return getCachedPreference(key, fallback);
}

/**
 * Persists a preference: writes the cache immediately (so the UI stays snappy)
 * and best-effort syncs to the server under the given category.
 */
export async function savePreference(key: string, value: any, category = 'ui_prefs'): Promise<void> {
  writeCache(key, value);
  await api.memory.set(key, value, category);
}
