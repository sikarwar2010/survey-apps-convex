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

function sessionHasConvexAud(claims: Record<string, unknown> | null | undefined): boolean {
  return claims?.aud === 'convex';
}

/**
 * Clerk → Convex auth bridge for `ConvexProviderWithAuth`.
 *
 * Matches `ConvexProviderWithClerk` token logic: when Clerk's Convex integration is
 * active, the session JWT already has `aud: "convex"` — use cached `getToken()` (no
 * template network call). Otherwise request the `convex` JWT template.
 *
 * Always calling `getToken({ template: "convex" })` causes `clerk_offline` on React
 * Native and leaves every user stuck on "Securing your session…".
 *
 * `getToken` from Clerk Expo is not referentially stable — keep it in a ref so
 * Convex does not call setAuth on every render (causes "Securing your session" loops).
 */
export function useAuthForConvex() {
  const { isLoaded, isSignedIn, getToken, sessionClaims, orgId, orgRole } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const sessionClaimsRef = useRef(sessionClaims);
  sessionClaimsRef.current = sessionClaims;
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
      const useCachedConvexJwt = sessionHasConvexAud(sessionClaimsRef.current);

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        const skipCache = refresh || attempt > 1;
        try {
          const token = useCachedConvexJwt
            ? await getTokenRef.current({ skipCache })
            : await getTokenRef.current({ template: 'convex', skipCache });
          if (token) return token;
          lastConvexTokenError = useCachedConvexJwt
            ? 'Clerk returned no session token. Sign out and sign in again.'
            : 'Clerk returned no token. Ask your admin to enable Clerk → Integrations → Convex (creates the "convex" JWT template).';
        } catch (err) {
          lastConvexTokenError = formatTokenError(err);
          // Template mint can fail offline on RN while the session JWT is valid.
          if (!useCachedConvexJwt) {
            try {
              const fallback = await getTokenRef.current({ skipCache: true });
              if (fallback) return fallback;
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
    [authEpoch, orgId, orgRole],
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
