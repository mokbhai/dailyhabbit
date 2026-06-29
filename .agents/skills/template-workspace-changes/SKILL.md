---
name: template-workspace-changes
description: Use when adding, renaming, removing, moving, or wiring any apps/* or packages/* workspace in the JainParichay template-jp PNPM/Turbo monorepo, including removing bundled template web apps, especially when package names, workspace:* links, pnpm catalogs, tsconfig presets, Turbo tasks, exports, README/docs commands, imports, or tests may need alignment.
---

# Template Workspace Changes

Use this skill to keep workspace graph changes in `template-jp` correct across manifests, config presets, imports, docs, and verification.

## Start With The Current Graph

Before editing, inspect the repo's actual conventions:

- `package.json` for root scripts, package manager, and root dev dependencies.
- `pnpm-workspace.yaml` for `apps/*`, `packages/*`, `catalog`, `catalogs`, and `allowBuilds`.
- `turbo.json` for task names, dependencies, caching, inputs, and outputs.
- `apps/*/package.json` and `packages/*/package.json` for names, scripts, exports, and local links.
- each workspace `tsconfig.json`, and `packages/config-typescript/*`, for the correct preset.
- `README.md`, `docs/guides/*`, source imports, and tests for hardcoded workspace names or filter commands.

Do not assume a root `tsconfig.json` exists. If one is absent, do not create it unless the change genuinely introduces root TypeScript compilation.

## Change Rules

- Keep workspace package names under the current starter scope unless the task is a scope rename. Current examples use `@workspace-starter/web`, `@workspace-starter/api`, `@workspace-starter/ui`, `@workspace-starter/types`, and `@workspace-starter/config-typescript`.
- Use `workspace:*` for every internal package dependency. After renames, update package manifests, source imports, TypeScript `paths`, root scripts, docs, and tests together.
- Prefer `catalog:` or `catalog:<name>` for shared dependency versions already centralized in `pnpm-workspace.yaml`. Add catalog entries for dependencies reused across workspaces; use literal versions only when a dependency is intentionally local to one workspace.
- Choose the closest TypeScript preset from `@workspace-starter/config-typescript`: `astro.json` for Astro apps, `nestjs.json` for NestJS apps, `react-library.json` for React libraries, `base.json` for plain TS packages, and `node.json` for Node packages.
- If adding or renaming a config preset, update both `packages/config-typescript/package.json` `exports` and `files`.
- Keep package `exports` aligned with build behavior. Built libraries such as UI should export `dist` artifacts; type-only/source-shared packages may export source when that is the established local pattern.
- Add or change `turbo.json` tasks only when matching workspace scripts exist or will exist. If a root script calls `turbo <task>`, confirm affected workspaces define that script or are intentionally skipped.
- Update README and guides when workspace names, filters, app/package lists, ports, or setup/start commands change. Fix stale absolute doc links when touching nearby docs.
- Update tests when invariants change. Existing root tests assert production start workspace filters; add focused tests for new cross-workspace invariants instead of relying only on manual review.
- When a user wants to remove the bundled web examples before creating their own app, prefer the supported command path: `pnpm template:remove-web-apps:dry-run`, then `pnpm template:remove-web-apps -- --yes`. It removes `apps/web`, `apps/secondary-web`, and `apps/web-host`, rewrites the root production `start` script and stock Docker Compose files to API-only, and refuses custom stale script or compose references. If changing that behavior, update `scripts/template/remove-web-apps.mjs`, `tests/remove-template-web-apps.test.mjs`, docs, and root command guardrails together.

## Minimal Edit Sequence

1. Map affected workspaces and all current references with `rg`.
2. Edit package manifests first, then TypeScript config, exports, imports, Turbo config, docs, and tests.
3. Re-run `rg` for old package names, old paths, stale filter commands, and removed scripts.
4. Keep changes narrow; do not refactor unrelated workspace structure while wiring one app or package.

## Verification

Run the smallest commands that prove the changed invariant:

- dependency or lockfile changes: `pnpm install --lockfile-only`
- one workspace: `pnpm --filter <workspace-name> typecheck`, plus `build` or `lint` when its scripts changed
- package exports or upstream dependency graph changes: `pnpm build`
- Turbo task or root script changes: the relevant root command, such as `pnpm typecheck`, `pnpm build`, or `pnpm test`
- test invariant changes: run the changed test file directly when possible, then the root `pnpm test` if root workspace behavior changed

If verification cannot run, report the exact command and reason.

## Common Failure Modes

- A package was renamed in `package.json` but not in imports, `paths`, docs, root scripts, or tests.
- A shared dependency was added with a literal version instead of `catalog:`.
- A workspace uses the wrong config-typescript preset.
- A new package lacks an `exports` entry that consumers can resolve.
- `turbo.json` contains a task no workspace implements.
- README or guide examples still reference removed package filters.
