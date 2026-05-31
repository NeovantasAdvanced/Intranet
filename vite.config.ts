import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import packageJson from './package.json';

const buildSha =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.GITHUB_SHA?.slice(0, 7) ??
  'local';
const appVersion = `${packageJson.version}+${buildSha}`;

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
  },
});
