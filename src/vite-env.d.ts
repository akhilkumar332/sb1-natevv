/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_LOCAL_API_URL: string;
    readonly VITE_PROD_API_URL: string;
  }
  
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }