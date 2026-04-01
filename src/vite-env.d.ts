/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /**
   * Commit SHA of the deployed build, injected by CI (VITE_APP_VERSION=$GITHUB_SHA).
   * Undefined in local dev — Settings falls back to "dev".
   * Surfaced in Settings → About so bug reports can name the exact build.
   */
  readonly VITE_APP_VERSION?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
