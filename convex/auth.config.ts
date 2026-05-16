/**
 * Authentication configuration.
 *
 * Convex validates incoming JWTs against the providers listed here. The
 * mobile app uses `@clerk/clerk-expo` to mint tokens with the
 * `convex` template (configured in the Clerk dashboard); each request to
 * a Convex function carries that JWT, which Convex verifies against
 * Clerk's JWKS endpoint and exposes via `ctx.auth.getUserIdentity()`.
 *
 * Setup:
 *   1. In Clerk dashboard → JWT Templates → create one named `convex`.
 *      Issuer becomes your Clerk instance URL.
 *   2. Set the env var `CLERK_JWT_ISSUER_DOMAIN` in Convex to that issuer.
 *      `npx convex env set CLERK_JWT_ISSUER_DOMAIN https://your-app.clerk.accounts.dev`
 *   3. Done — no shared secret, no manual key rotation.
 */
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};
