import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const appVersion =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.GITHUB_RUN_NUMBER ?? '0';

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
  },
});
