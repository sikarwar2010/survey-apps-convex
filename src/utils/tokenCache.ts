/**
 * Clerk token cache backed by expo-secure-store.
 *
 * Without a cache, Clerk re-mints tokens on every app launch which delays
 * the first authenticated render. Wrapped so Android secure-store failures
 * never crash startup (returns null → Clerk treats as signed out).
 */
import * as SecureStore from 'expo-secure-store';

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (__DEV__) {
      console.warn('[tokenCache]', err instanceof Error ? err.message : err);
    }
    return fallback;
  }
}

export const tokenCache = {
  getToken(key: string) {
    return safe(() => SecureStore.getItemAsync(key), null);
  },
  saveToken(key: string, value: string) {
    return safe(() => SecureStore.setItemAsync(key, value), undefined);
  },
  clearToken(key: string) {
    return safe(() => SecureStore.deleteItemAsync(key), undefined);
  },
};
