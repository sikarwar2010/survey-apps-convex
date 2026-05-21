import { sessionClaimsHaveConvexAud, tokenHasConvexAud } from '@/utils/jwt';
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

function isClerkOfflineError(err: unknown): boolean {
  const msg = formatTokenError(err).toLowerCase();
  return msg.includes('clerk_offline') || msg.includes('offline');
}

/**
 * Clerk → Convex auth bridge for `ConvexProviderWithAuth`.
 *
 * On React Native, `getToken({ template: "convex" })` often fails with `clerk_offline`
 * even when the cached session JWT already has `aud: "convex"` (Clerk → Convex integration).
 * Always read the session token first and inspect its `aud` claim before minting a template.
 *
 * `getToken` from Clerk Expo is not referentially stable — keep it in a ref so
 * Convex does not call setAuth on every render (causes "Securing your session" loops).
 */
export function useAuthForConvex() {
  const { isLoaded, isSignedIn, getToken, sessionClaims } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const [authEpoch, setAuthEpoch] = useState(0);
  const hadConvexAudRef = useRef(false);

  useEffect(() => {
    const bump = () => setAuthEpoch((n) => n + 1);
    authRetryListeners.add(bump);
    return () => {
      authRetryListeners.delete(bump);
    };
  }, []);

  useEffect(() => {
    const hasConvexAud = sessionClaimsHaveConvexAud(sessionClaims);
    if (hasConvexAud && !hadConvexAudRef.current) {
      hadConvexAudRef.current = true;
      setAuthEpoch((n) => n + 1);
    }
    if (!hasConvexAud) {
      hadConvexAudRef.current = false;
    }
  }, [sessionClaims]);

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      lastConvexTokenError = null;
      const refresh = forceRefreshToken || authEpoch > 0;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        const skipCache = refresh || attempt > 1;

        try {
          const sessionToken = await getTokenRef.current({ skipCache });
          if (sessionToken && tokenHasConvexAud(sessionToken)) {
            return sessionToken;
          }

          try {
            const templateToken = await getTokenRef.current({
              template: 'convex',
              skipCache,
            });
            if (templateToken) return templateToken;
          } catch (templateErr) {
            lastConvexTokenError = formatTokenError(templateErr);
            if (sessionToken && tokenHasConvexAud(sessionToken)) {
              return sessionToken;
            }
          }

          if (!sessionToken) {
            lastConvexTokenError = 'Clerk returned no session token. Sign out and sign in again.';
          } else {
            lastConvexTokenError =
              'Clerk session is missing Convex audience (aud: convex). In Clerk Dashboard → Integrations → Convex → Activate.';
          }
        } catch (err) {
          lastConvexTokenError = formatTokenError(err);
          if (isClerkOfflineError(err)) {
            try {
              const fallback = await getTokenRef.current({ skipCache: true });
              if (fallback && tokenHasConvexAud(fallback)) return fallback;
            } catch (fallbackErr) {
              lastConvexTokenError = formatTokenError(fallbackErr);
            }
          }
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
