/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HIGHSCORE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
