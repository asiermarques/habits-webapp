// Name of the service-worker runtime cache that holds GET /api/* responses.
// Must match the `cacheName` of the API runtimeCaching route in vite.config.ts.
export const API_CACHE_NAME = 'habits-api-cache';

// Drop every cached API response. Called when the instance gate is locked
// (logout) so that offline reads can't resurface another session's data —
// the deliberate gate × cache policy (RISK-G1). No-op where the Cache Storage
// API is unavailable (non-secure contexts, older browsers, tests).
export async function clearApiCache(): Promise<void> {
  if (typeof caches === 'undefined') return;
  await caches.delete(API_CACHE_NAME);
}
