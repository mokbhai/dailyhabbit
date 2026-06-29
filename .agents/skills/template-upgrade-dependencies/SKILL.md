---
name: template-upgrade-dependencies
description: Use when upgrading, pinning, replacing, or auditing dependencies in the JainParichay template-jp PNPM/Turbo monorepo, especially when pnpm catalogs, pnpm-lock.yaml, Turbo tasks, Astro, NestJS, tRPC, React 19, Tailwind 4, TypeScript 6, ESLint, or Changesets may be affected.
---

# Template Upgrade Dependencies

Use this skill for dependency upgrade work in `template-jp`. Dependency changes in this repo are cross-workspace changes: a version bump can affect catalogs, package manifests, lockfiles, build outputs, peer ranges, generated types, docs, and release metadata.

## Start With Facts

Before editing, inspect the current dependency graph and upgrade intent:

- `package.json` for root scripts, `packageManager`, engines, Changesets scripts, and root dev dependencies.
- `pnpm-workspace.yaml` for `catalog`, named `catalogs`, `minimumReleaseAge`, and `allowBuilds`.
- `pnpm-lock.yaml` for resolved versions and peer dependency shape.
- `apps/*/package.json` and `packages/*/package.json` for workspace-local dependency placement, scripts, peer ranges, and `workspace:*` links.
- `turbo.json` for which validation tasks are available and how task dependencies broaden the blast radius.
- `.changeset/config.json` and existing `.changeset/*.md` when the dependency change affects publishable package behavior.

Do not trust memory for latest versions. Use package-manager metadata such as `pnpm outdated`, `pnpm info <pkg> version`, release notes, or official docs for version-sensitive decisions.

## Upgrade Strategy

- Prefer catalog updates for shared versions already centralized in `pnpm-workspace.yaml`. Use literal versions only when the dependency is intentionally local to one workspace.
- Keep internal workspace dependencies as `workspace:*`.
- Group related framework packages so their compatibility stays coherent: React with `react-dom` and React types, tRPC packages together, Tailwind with `@tailwindcss/vite`, TypeScript with eslint tooling, Nest packages together, and Astro with its integrations.
- Treat major upgrades as compatibility work, not simple version bumps. Read migration notes and inspect affected config/source before changing manifests.
- Avoid broad `pnpm update --latest -r` upgrades unless the user explicitly asked for a sweep and the repo has enough validation budget. Prefer targeted package families.
- Do not add `overrides`, `packageExtensions`, or relaxed peer ranges just to silence install warnings. Use them only when there is a concrete compatibility reason and document that reason.
- Preserve the root `packageManager` pin unless the task explicitly includes a pnpm upgrade. If pnpm itself changes, update docs and CI/bootstrap assumptions that mention the pinned version.
- Preserve `allowBuilds` deliberately. If a new dependency needs a build approval, verify it is expected before adding it.

## Compatibility Hotspots

- Astro upgrades can affect `astro.config.*`, `@astrojs/check`, Vite behavior, React islands, and `.astro` build output expectations.
- NestJS upgrades can affect Fastify integration, decorators, reflect metadata, CLI output, and TypeScript compiler requirements.
- tRPC upgrades can affect router types, React Query integration, and client/server package alignment.
- React 19 upgrades can affect peer ranges in `packages/ui`, `@types/react`, hydration behavior, and testing-library compatibility.
- Tailwind 4 upgrades can affect Vite plugin usage, CSS entrypoints, class scanning, and `tailwind-merge` behavior.
- TypeScript 6 upgrades can affect config presets in `packages/config-typescript`, declaration emit, ESLint parser support, and Astro/Nest typechecks.
- Changesets upgrades can affect release scripts and generated changeset files.

## Edit Sequence

1. Identify the exact package family and affected workspaces with `rg` and package manifests.
2. Update `pnpm-workspace.yaml` catalogs first for shared dependencies, then package manifests that need local additions, removals, or peer range changes.
3. Run `pnpm install --lockfile-only` after manifest/catalog changes so `pnpm-lock.yaml` reflects the intended graph.
4. Re-check `pnpm outdated` or `pnpm list --depth <n>` for the touched packages when version alignment matters.
5. Update source, config, tests, docs, or `.changeset` files only where the dependency behavior actually changed.
6. Re-run `rg` for old versions, deprecated package names, stale setup commands, and outdated docs near touched areas.

## Changesets

Most dependency-only template maintenance does not need a changeset because all current workspaces are private. Add or update a changeset only when the dependency change affects publishable package behavior, release docs, or when the repo policy/user request explicitly calls for one.

If adding a changeset, keep it narrow and name the affected package behavior, not just the upgraded dependency.

## Verification

Run the narrowest reliable checks for the touched surface:

```bash
pnpm install --lockfile-only
pnpm lint
pnpm typecheck
pnpm test
```

Also run `pnpm build` when build tooling, Astro, NestJS, UI package exports, Tailwind, TypeScript, or Turbo behavior changed. For a single workspace dependency, a focused command such as `pnpm --filter @workspace-starter/web typecheck` may be useful before the root command, but do not stop there if the dependency is shared through a catalog.

Do not run `pnpm dev`, `pnpm start`, or workspace `dev`/`start` scripts unless the user explicitly asks.

If a command cannot run, report the exact command, the failure reason, and the remaining risk.

## Common Failure Modes

- Updating a workspace manifest while leaving the shared catalog stale, or updating the catalog while a workspace still pins a literal old version.
- Bumping only one package in a tightly coupled family, such as `@trpc/server` without `@trpc/client` and `@trpc/react-query`.
- Accepting peer dependency warnings without checking whether runtime behavior is actually compatible.
- Forgetting that TypeScript, `@typescript-eslint/*`, Astro check, and Nest CLI compatibility are coupled.
- Leaving `pnpm-lock.yaml`, docs, or `.changeset` files inconsistent with manifest changes.
- Treating a passing install as sufficient validation after compiler, framework, or build-tool upgrades.
