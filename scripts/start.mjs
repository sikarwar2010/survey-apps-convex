/**
 * Reliable LAN dev server for Expo Go (no ngrok tunnel).
 *
 * - Loads `.env.local` before Metro starts
 * - Sets REACT_NATIVE_PACKAGER_HOSTNAME to the best LAN IPv4 (fixes wrong IP on Windows)
 * - Uses `--lan` explicitly
 *
 * Prefer:  bun run start
 * Not:     bunx expo start --tunnel  (only needed when phone and PC are on different networks)
 */
import { spawn } from "node:child_process";
import { loadEnvLocal } from "./load-env-local.mjs";
import { pickLanHost } from "./pick-lan-host.mjs";

const extraArgs = process.argv.slice(2);
const hasHostFlag = extraArgs.some((a) => a === "--tunnel" || a === "--localhost" || a.startsWith("--host"));

loadEnvLocal();

const lanHost = pickLanHost();
if (lanHost && !process.env.REACT_NATIVE_PACKAGER_HOSTNAME) {
  process.env.REACT_NATIVE_PACKAGER_HOSTNAME = lanHost;
}

if (lanHost) {
  console.log(`LAN dev host: ${lanHost} (Expo Go must be on the same Wi‑Fi)\n`);
} else {
  console.log("Could not detect a LAN IP — Expo will choose one automatically.\n");
}

if (!process.env.EXPO_PUBLIC_CONVEX_URL || !process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY) {
  console.warn(
    "Warning: EXPO_PUBLIC_CONVEX_URL or EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY missing in .env.local\n",
  );
}

console.log("Tips if Expo Go cannot connect:");
console.log("  • Phone and PC on the same Wi‑Fi (not mobile data)");
console.log("  • Allow Node.js through Windows Firewall on port 8081");
console.log("  • Android USB: bun run android:usb");
console.log("  • Different networks only: bun run start:tunnel\n");

const expoArgs = ["expo", "start", ...(hasHostFlag ? [] : ["--lan"]), ...extraArgs];
const child = spawn("bunx", expoArgs, {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 1));
