import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

import { defaultLocale, locales } from './src/i18n/config';

const i18nLocales = [...locales];
const nodeEnv = (
  globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }
).process?.env;
// A static build emits a flat dist/ with no server runtime. Used both for
// GitHub Pages and for aggregation behind apps/web-host. Any other value (or
// none) keeps the node standalone adapter for local preview and standalone
// containers.
const isStaticBuild =
  nodeEnv?.ASTRO_DEPLOY_TARGET === 'github-pages' ||
  nodeEnv?.ASTRO_DEPLOY_TARGET === 'static';

export default defineConfig({
  output: 'static',
  ...(isStaticBuild
    ? {}
    : {
        adapter: node({
          mode: 'standalone',
        }),
      }),
  ...(nodeEnv?.ASTRO_SITE ? { site: nodeEnv.ASTRO_SITE } : {}),
  ...(nodeEnv?.ASTRO_BASE ? { base: nodeEnv.ASTRO_BASE } : {}),

  i18n: {
    locales: i18nLocales,
    defaultLocale,
    routing: {
      prefixDefaultLocale: false,
    },
  },

  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
    // Strategy A: UI package ships pre-built dist/
    // Tell Vite to pre-bundle it so it's optimized at dev startup
    optimizeDeps: {
      include: [
        '@workspace-starter/ui',
        '@trpc/client',
        '@tanstack/react-query',
      ],
    },
  },
});
