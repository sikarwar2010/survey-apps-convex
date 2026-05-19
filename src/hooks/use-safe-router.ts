import { useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { useCallback, useRef } from 'react';

/**
 * Avoid duplicate router.replace calls — rapid redirects can crash Android release builds.
 */
export function useSafeRouter() {
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const navigationReady = Boolean(navigationState?.key);
  const lastTarget = useRef<string | null>(null);

  const replace = useCallback(
    (href: string) => {
      if (!navigationReady) return;
      if (lastTarget.current === href) return;
      lastTarget.current = href;
      try {
        router.replace(href as never);
      } catch (err) {
        if (__DEV__) {
          console.warn('[navigation] replace failed:', href, err);
        }
        lastTarget.current = null;
      }
    },
    [navigationReady, router],
  );

  return { replace, segments, navigationReady };
}
