/**
 * Clerk issuer for Convex JWT validation.
 *
 * `CLERK_JWT_ISSUER_DOMAIN` on the deployment overrides this (see auth.config.ts).
 * Keep in sync with `CLERK_JWT_ISSUER_DOMAIN` in `.env.local` / EAS Clerk instance.
 */
export const CLERK_JWT_ISSUER_FALLBACK = 'https://organic-halibut-21.clerk.accounts.dev';
