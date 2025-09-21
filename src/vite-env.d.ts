/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_KITE_API_KEY: string
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}