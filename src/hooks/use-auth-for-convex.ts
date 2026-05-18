import { useAuth } from '@clerk/expo';
import { useCallback, useMemo, useRef } from 'react';

/** Last getToken failure — shown on ConvexAuthError in dev. */
export let lastConvexTokenError: string | null = null;

const RETRY_MS = 600;
const MAX_ATTEMPTS = 4;

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

  const fetchAccessToken = useCallback(async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
    lastConvexTokenError = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const token = await getTokenRef.current({
          template: 'convex',
          skipCache: forceRefreshToken,
        });
        if (token) return token;
        lastConvexTokenError =
          'Clerk returned no token. In Clerk Dashboard → Integrations → enable "Convex", or add a JWT template named "convex".';
      } catch (err) {
        lastConvexTokenError = formatTokenError(err);
        if (attempt < MAX_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, RETRY_MS * attempt));
          continue;
        }
      }
      break;
    }

    if (__DEV__ && lastConvexTokenError) {
      console.warn('[convex-auth]', lastConvexTokenError);
    }
    return null;
  }, []);

  return useMemo(
    () => ({
      isLoading: !isLoaded,
      isAuthenticated: isSignedIn ?? false,
      fetchAccessToken,
    }),
    [isLoaded, isSignedIn, fetchAccessToken],
  );
}
