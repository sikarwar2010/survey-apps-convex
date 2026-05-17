/**
 * Patches @expo/cli to use NGROK_AUTHTOKEN instead of Expo's shared token.
 *
 * Expo's built-in token is often rate-limited (ERR_NGROK_108), which surfaces as:
 *   TypeError: Cannot read properties of undefined (reading 'body')
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PATCH_MARKER = "// @survey-app/ngrok-byot";
const EXPO_SHARED_TOKEN = "5W1bR67GNbWcXqmxZzBG1_56GezNeaX6sSRvn8npeQ8";

export function getAsyncNgrokPath(cwd = process.cwd()) {
  return join(cwd, "node_modules/@expo/cli/build/src/start/server/AsyncNgrok.js");
}

export function patchExpoNgrok(userToken, cwd = process.cwd()) {
  const path = getAsyncNgrokPath(cwd);
  if (!existsSync(path)) {
    throw new Error("Missing @expo/cli — run `bun install` first.");
  }

  let src = readFileSync(path, "utf8");

  if (!src.includes(EXPO_SHARED_TOKEN) && !src.includes(PATCH_MARKER)) {
    const tokenRe = /authToken:\s*['"][^'"]+['"]/;
    if (!tokenRe.test(src)) {
      throw new Error("AsyncNgrok.js format changed — cannot apply ngrok patch.");
    }
    src = src.replace(tokenRe, `authToken: ${JSON.stringify(userToken)}, ${PATCH_MARKER}`);
  } else if (src.includes(EXPO_SHARED_TOKEN)) {
    src = src.replace(
      `authToken: '${EXPO_SHARED_TOKEN}'`,
      `authToken: ${JSON.stringify(userToken)}, ${PATCH_MARKER}`,
    );
  } else {
    src = src.replace(
      new RegExp(`authToken:\\s*['"][^'"]+['"],\\s*${PATCH_MARKER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
      `authToken: ${JSON.stringify(userToken)}, ${PATCH_MARKER}`,
    );
  }

  // Free/personal ngrok accounts cannot use *.exp.direct hostnames (ERR_NGROK_313).
  if (src.includes("...urlProps,")) {
    src = src.replace(
      /const url = await instance\.connect\(\{\s*\n\s*\.\.\.urlProps,/,
      `const url = await instance.connect({\n                ${PATCH_MARKER} skip exp.direct hostname`,
    );
  }

  writeFileSync(path, src);
}
