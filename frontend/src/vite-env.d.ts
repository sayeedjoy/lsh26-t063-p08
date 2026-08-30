/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Build-time fallback for the API origin. Empty/unset means same-origin
   * (`/api/...`). Prefer the runtime `API_URL` env var in containers — this
   * one is baked into the bundle and needs a rebuild to change.
   */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/**
 * Injected by `/env.js`, which the container's static server renders from the
 * process environment on every request. That is what makes one built image
 * work against any backend origin without rebuilding.
 */
interface Window {
  __APP_ENV__?: {
    API_URL?: string
  }
}
