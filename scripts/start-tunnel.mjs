/**
 * Start Expo with --tunnel using your own ngrok account.
 *
 * `bunx expo start --tunnel` uses Expo's shared ngrok token, which is often
 * exhausted and fails with:
 *   Cannot read properties of undefined (reading 'body')
 *
 * This script patches @expo/cli to use NGROK_AUTHTOKEN from .env.local instead.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { patchExpoNgrok } from "./patch-expo-ngrok.mjs";

function loadEnvLocal() {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key]) continue;
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

loadEnvLocal();

const token = process.env.NGROK_AUTHTOKEN?.trim();
if (!token) {
  console.error("\nTunnel mode needs your own ngrok token (Expo's shared tunnel is unreliable).\n");
  console.error("1. Free account: https://dashboard.ngrok.com/signup");
  console.error("2. Copy token:    https://dashboard.ngrok.com/get-started/your-authtoken");
  console.error("3. Add to .env.local:");
  console.error("     NGROK_AUTHTOKEN=your_token_here");
  console.error("4. Run:  bun run start:tunnel\n");
  console.error("If ngrok still fails (agent version ERR_NGROK_121 on free tier), use:");
  console.error("  bun run start              # same Wi‑Fi");
  console.error("  bun run android:usb        # Android USB");
  console.error("  cloudflared tunnel --url http://localhost:8081  # then EXPO_PACKAGER_PROXY_URL=… bun run start\n");
  process.exit(1);
}

try {
  patchExpoNgrok(token);
  console.log("Using NGROK_AUTHTOKEN from .env.local for tunnel mode.\n");
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

const child = spawn("bunx", ["expo", "start", "--tunnel"], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 1));
