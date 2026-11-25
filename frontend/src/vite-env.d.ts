/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Defaults to "/api" (same origin). */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
