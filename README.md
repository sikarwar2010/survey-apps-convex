# SDV survey mobile app (Expo)

Field survey capture for Android/iOS. Writes to the **same Convex deployment** as the admin web app in [`../sdv-front-new-app`](../sdv-front-new-app).

## Shared backend

- **Do not run `convex dev` here.** Start the backend from the web repo: `cd ../sdv-front-new-app && npm run dev`.
- **Do not run `npm run deploy` here** — it exits with instructions; deploy from `sdv-front-new-app`.
- `convex/` in this repo is kept in sync with the web app for TypeScript types (`api.survey.*`, etc.).
- `EXPO_PUBLIC_CONVEX_URL` must match `NEXT_PUBLIC_CONVEX_URL` in the web app.
- Use the **same Clerk application** as the web (`EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_JWT_ISSUER_DOMAIN`).

## Getting started

1. Ensure the web backend is running (`npm run dev` in `../sdv-front-new-app`).

2. Configure env:

   ```bash
   cp .env.example .env.local
   ```

   Copy `EXPO_PUBLIC_CONVEX_URL` and Clerk values from `../sdv-front-new-app/.env.local`.

3. Install and run Expo:

   ```bash
   npm install
   npm run dev
   ```

## EAS builds

Set `EXPO_PUBLIC_CONVEX_URL` and `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` in EAS environment variables to the **production** values from the web deployment (same Convex project, same Clerk app).
