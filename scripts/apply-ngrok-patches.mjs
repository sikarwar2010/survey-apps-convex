import { patchExpoNgrok } from "./patch-expo-ngrok.mjs";
import { patchExpoWsTunnel } from "./patch-expo-ws-tunnel.mjs";
import { patchNgrokClient } from "./patch-ngrok-client.mjs";

try {
  const ws = patchExpoWsTunnel();
  const cli = patchExpoNgrok();
  const client = patchNgrokClient();
  if (ws || cli || client) {
    console.log("Applied Expo tunnel patches (ws-tunnel, ngrok fallbacks).");
  }
} catch (err) {
  console.warn(
    "ngrok patch skipped:",
    err instanceof Error ? err.message : err,
  );
}
