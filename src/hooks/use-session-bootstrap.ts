import { useAuth } from '@clerk/expo';
import { useEffect, useRef } from 'react';
import { useClerkConvexAuth } from './use-clerk-convex-auth';

/**
 * True after the first successful Clerk + Convex + profile bootstrap.
 * Avoids full-screen "Securing your session" on hot reload / token refresh.
 */
export function useSessionBootstrap(me: unknown, needsSync: boolean, syncing: boolean) {
  const { isSignedIn } = useAuth();
  const { convexReady, convexAuthLoading } = useClerkConvexAuth();
  const bootstrapped = useRef(false);

  const profilePending = convexReady && me === undefined;
  const setupPending = convexReady && needsSync && syncing;
  const accountReady = me !== null || !needsSync;

  if (isSignedIn && convexReady && me !== undefined && accountReady && !setupPending) {
    bootstrapped.current = true;
  }

  useEffect(() => {
    if (!isSignedIn) {
      bootstrapped.current = false;
    }
  }, [isSignedIn]);

  const showBlockingOverlay =
    Boolean(isSignedIn) &&
    !bootstrapped.current &&
    (convexAuthLoading || !convexReady || profilePending || setupPending);

  return { showBlockingOverlay, bootstrapped: bootstrapped.current };
}
