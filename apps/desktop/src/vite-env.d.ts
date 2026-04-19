/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLOUDCODE_BUILD_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
