/**
 * Dev entry: Convex in background, Expo in foreground with LAN env + real TTY.
 */
import { execSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { prepareExpoDevEnv, printExpoDevTips, spawnExpo } from "./expo-dev.mjs";
import { patchExpoNgrok } from "./patch-expo-ngrok.mjs";
import { patchExpoWsTunnel } from "./patch-expo-ws-tunnel.mjs";
import { patchNgrokClient } from "./patch-ngrok-client.mjs";

const tunnel = process.argv.includes("--tunnel");
const extraArgs = process.argv.slice(2).filter((a) => a !== "--tunnel");

if (tunnel) {
  process.env.EXPO_USE_WS_TUNNEL = "1";
  try {
    patchExpoWsTunnel();
    patchExpoNgrok();
    patchNgrokClient();
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
  try {
    if (process.platform === "win32") {
      execSync("taskkill /F /IM ngrok.exe", { stdio: "ignore" });
    }
  } catch {
    /* none running */
  }
}

const lanHost = prepareExpoDevEnv();

if (!process.env.EXPO_PUBLIC_CONVEX_URL || !process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY) {
  console.warn(
    "Warning: EXPO_PUBLIC_CONVEX_URL or EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY missing in .env.local\n",
  );
}

printExpoDevTips(lanHost, { tunnel });

const convexEntry = join(process.cwd(), "node_modules", "convex", "bin", "main.js");
if (!existsSync(convexEntry)) {
  console.error("Missing convex — run bun install or npm install first.");
  process.exit(1);
}

function prefixLines(chunk, tag) {
  for (const line of chunk.toString().split(/\r?\n/)) {
    if (line.length > 0) process.stderr.write(`${tag} ${line}\n`);
  }
}

const convex = spawn(process.execPath, [convexEntry, "dev"], {
  detached: false,
  stdio: ["ignore", "pipe", "pipe"],
  env: process.env,
});
convex.stdout?.on("data", (d) => prefixLines(d, "[convex]"));
convex.stderr?.on("data", (d) => prefixLines(d, "[convex]"));
console.log("[convex] dev server starting…\n");

if (process.env.CLERK_JWT_ISSUER_DOMAIN) {
  try {
    execSync(
      `npx convex env set CLERK_JWT_ISSUER_DOMAIN "${process.env.CLERK_JWT_ISSUER_DOMAIN}"`,
      { stdio: "ignore", env: process.env },
    );
  } catch {
    /* already set or offline */
  }
}

function killTree(child) {
  if (!child?.pid) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
  } else {
    child.kill("SIGTERM");
  }
}

const expo = spawnExpo(extraArgs, { tunnel });

let exiting = false;
function shutdown(code = 0) {
  if (exiting) return;
  exiting = true;
  killTree(expo);
  killTree(convex);
  process.exit(code);
}

process.on("SIGINT", () => shutdown(130));
process.on("SIGTERM", () => shutdown(143));
expo.on("exit", (code) => shutdown(code ?? 1));
convex.on("exit", (code) => {
  if (!exiting && code !== 0) {
    console.error(
      "\n[convex] exited — check CONVEX_DEPLOYMENT in .env.local (no inline # comments on the same line).",
    );
    shutdown(code ?? 1);
  }
});
