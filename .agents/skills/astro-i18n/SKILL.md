---
name: astro-i18n
description: Use when adding or changing localization, translation catalogs, language switching, locale routing, Astro i18n configuration, or the packages/i18n helper package in the JainParichay template-jp Astro app.
---

# Astro i18n

Use Astro's built-in i18n routing for URL behavior. Do not recreate locale path helpers for normal localized routes; use `astro:i18n` helpers such as `getRelativeLocaleUrl()` and keep `apps/web/astro.config.ts` aligned with `apps/web/src/i18n/config.ts`.

## Architecture

- `apps/web/src/i18n/config.ts` owns the web app's supported locales, default locale, and fallback locale.
- `apps/web/src/locales/<locale>/<namespace>.json` owns app-specific human-facing strings.
- `packages/i18n` owns generic translator and catalog validation helpers only. Do not put page-specific web copy in the shared package.
- Keep route structure, commands, IDs, icons, tones, and other non-translatable data in TypeScript. Keep visible UI text in JSON catalogs.
- Avoid hand-written page copy interfaces. Let JSON catalogs be the source of truth and use validation tests to catch missing or drifted keys.

## Implementation Rules

When adding a locale or namespace:

1. Update `apps/web/src/i18n/config.ts` and `apps/web/astro.config.ts` through the shared locale constants.
2. Add matching JSON namespace files under every configured locale folder.
3. Use `getTranslations(locale, namespace)` from `apps/web/src/i18n/messages.ts` in Astro components.
4. Use `astro:i18n` URL helpers for language-switch links.
5. Extend `apps/web/tests/locales.test.mjs` when new namespaces are introduced.

For larger message needs such as plurals, rich text, dates, or runtime language switching inside React islands, prefer evolving `packages/i18n` behind the existing app wrapper instead of importing a third-party i18n library directly throughout components.

## Verification

Run focused checks after i18n changes:

```bash
pnpm --filter @workspace-starter/i18n test
pnpm --filter @workspace-starter/web test
pnpm --filter @workspace-starter/web typecheck
pnpm --filter @workspace-starter/web lint
```

Run `pnpm build` when routing config, workspace package exports, or locale-dependent rendering changes.
