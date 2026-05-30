/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  // Minutes a gated instance stays readable offline after the last online
  // unlock (see GateGuard). Un-prefixed (exposed via `define` in vite.config.ts,
  // not Vite's VITE_ auto-exposure). Optional; defaults to 120 (2h).
  readonly GATE_OFFLINE_GRACE_MINUTES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
