import { useAuth } from '@clerk/expo';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/** Last getToken failure — shown on ConvexAuthError. */
export let lastConvexTokenError: string | null = null;

const RETRY_MS = 800;
const MAX_ATTEMPTS = 8;

const authRetryListeners = new Set<() => void>();

/** Force ConvexProviderWithAuth to fetch a fresh Clerk `convex` JWT. */
export function retryConvexAuth() {
  for (const listener of authRetryListeners) listener();
}

function formatTokenError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return 'Unknown error fetching Clerk token';
  }
}

/**
 * Clerk → Convex auth bridge for `ConvexProviderWithAuth`.
 * Always requests the `convex` JWT template (Convex + Clerk dashboard integration).
 *
 * `getToken` from Clerk Expo is not referentially stable — keep it in a ref so
 * Convex does not call setAuth on every render (causes "Securing your session" loops).
 */
export function useAuthForConvex() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const [authEpoch, setAuthEpoch] = useState(0);

  useEffect(() => {
    const bump = () => setAuthEpoch((n) => n + 1);
    authRetryListeners.add(bump);
    return () => {
      authRetryListeners.delete(bump);
    };
  }, []);

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      lastConvexTokenError = null;
      const refresh = forceRefreshToken || authEpoch > 0;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        try {
          const token = await getTokenRef.current({
            template: 'convex',
            skipCache: refresh || attempt > 1,
          });
          if (token) return token;
          lastConvexTokenError =
            'Clerk returned no token. Ask your admin to enable Clerk → Integrations → Convex (creates the "convex" JWT template).';
        } catch (err) {
          lastConvexTokenError = formatTokenError(err);
        }
        if (attempt < MAX_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, RETRY_MS * attempt));
        }
      }

      if (__DEV__ && lastConvexTokenError) {
        console.warn('[convex-auth]', lastConvexTokenError);
      }
      return null;
    },
    [authEpoch],
  );

  return useMemo(
    () => ({
      isLoading: !isLoaded,
      isAuthenticated: isSignedIn ?? false,
      fetchAccessToken,
    }),
    [isLoaded, isSignedIn, fetchAccessToken],
  );
}
