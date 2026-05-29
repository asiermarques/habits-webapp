// Test stub for `virtual:pwa-register/react`. That module is synthesised by
// vite-plugin-pwa only during a real build, so under vitest we alias the import
// to this no-op (see vitest.config.ts). Tests that exercise the update flow
// override it with `vi.mock('virtual:pwa-register/react', …)`.
export function useRegisterSW() {
  return {
    needRefresh: [false, () => {}] as [boolean, (value: boolean) => void],
    offlineReady: [false, () => {}] as [boolean, (value: boolean) => void],
    updateServiceWorker: async (_reloadPage?: boolean) => {},
  };
}
