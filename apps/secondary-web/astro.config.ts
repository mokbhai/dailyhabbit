import { defineConfig } from 'astro/config';

const nodeEnv = (
  globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }
).process?.env;

// The base path must match the path this frontend is mounted at by
// apps/web-host. build-frontends.mjs sets ASTRO_BASE per app from the mount
// path; the default mirrors the directory-name convention (/secondary-web).
export default defineConfig({
  output: 'static',
  base: nodeEnv?.ASTRO_BASE ?? '/secondary-web',
});
