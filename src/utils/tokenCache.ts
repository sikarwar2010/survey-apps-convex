/**
 * Clerk token cache backed by expo-secure-store.
 *
 * Without a cache, Clerk re-mints tokens on every app launch which delays
 * the first authenticated render by ~800 ms. With this, users open the
 * app already signed in.
 */
import * as SecureStore from "expo-secure-store";

export const tokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      /* noop */
    }
  },
};
