/**
 * 8-step wizard layout.
 *
 * Header is per-screen (each step renders its own WizardHeader so the
 * step indicator can highlight the active step). Stack just orchestrates
 * navigation; no shared chrome.
 */
import { Stack } from "expo-router";

export default function WizardLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        gestureEnabled: true,
      }}
    />
  );
}
