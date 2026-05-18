/**
 * Survey GPS accuracy (meters). Shared with the mobile app via `@/convex/gpsAccuracy`.
 *
 * - Target ±2–3 m outdoors (ideal for the survey UI).
 * - Accept up to ±20 m when the device cannot reach GNSS precision (common on phones).
 */
export const GPS_EXCELLENT_ACCURACY_METERS = 2;
export const GPS_TARGET_ACCURACY_METERS = 3;
export const GPS_ACCEPT_MAX_ACCURACY_METERS = 20;

/** @deprecated Use GPS_ACCEPT_MAX_ACCURACY_METERS — kept for existing imports */
export const GPS_MAX_ACCURACY_METERS = GPS_ACCEPT_MAX_ACCURACY_METERS;

/** Max time to refine a fix (ms). Stops earlier when accuracy thresholds are met. */
export const GPS_SAMPLE_DURATION_MS = 10_000;

/** Minimum fixes before accepting a reading at the “acceptable” tier (≤20 m). */
export const GPS_MIN_SAMPLES_ACCEPT = 2;

/** Minimum fixes before accepting at the target tier (≤3 m). */
export const GPS_MIN_SAMPLES_TARGET = 2;

/** Poll interval while waiting for a good fix (ms). */
export const GPS_SAMPLE_POLL_MS = 200;
