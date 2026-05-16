/**
 * Centralised env access for the Expo app.
 *
 * EXPO_PUBLIC_* vars are inlined at build time. Set in `.env`:
 *
 *   EXPO_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
 *   EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
 */
export const env = {
  convexUrl: process.env.EXPO_PUBLIC_CONVEX_URL ?? "",
  clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "",
};

if (!env.convexUrl) {
  // eslint-disable-next-line no-console
  console.warn("[env] EXPO_PUBLIC_CONVEX_URL is not set — backend calls will fail.");
}
if (!env.clerkPublishableKey) {
  // eslint-disable-next-line no-console
  console.warn("[env] EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not set — auth will fail.");
}
