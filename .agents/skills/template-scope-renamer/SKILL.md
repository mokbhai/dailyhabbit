---
name: template-scope-renamer
description: Use when renaming the JainParichay template-jp monorepo internal npm package scope, or auditing and fixing stale internal package scope references across package manifests, workspace links, imports, TypeScript paths, tests, docs, scripts, local project skills, and pnpm-lock.yaml.
---

# Template Scope Renamer

Use this skill to rename the internal workspace package scope as one coordinated migration. Treat partial scope drift as a correctness bug, especially when package manifests, imports, TypeScript paths, docs, tests, and the lockfile disagree.

## Scope Contract

- Require explicit old and new scopes, such as `OLD_SCOPE` to `NEW_SCOPE`. If the new scope is missing or ambiguous, ask before editing.
- Validate scopes with the conservative npm-scope shape `@[a-z0-9][a-z0-9._-]*`. Reject unscoped names for this workflow.
- Rename scoped workspace package identities only: `OLD_SCOPE/package` becomes `NEW_SCOPE/package`.
- Keep package basenames, workspace directories, app ports, root package name, product copy, and public branding unchanged unless the user explicitly asks to rename those too.
- Use `template-workspace-changes` as well if the request also adds, removes, moves, or rewires `apps/*` or `packages/*`.

## Map Before Editing

Inspect the current graph before making changes:

```bash
rg -n --hidden --glob '!node_modules' --glob '!.git' --glob '!dist' --glob '!.astro' --glob '!.turbo' --glob '!coverage' 'OLD_SCOPE|OLD_SCOPE_WITHOUT_AT' .
node .agents/skills/template-scope-renamer/scripts/audit-scope-references.mjs OLD_SCOPE . --include-unscoped
```

Read only the files needed for the specific hits, but include these surfaces in the map:

- root `package.json`, `pnpm-workspace.yaml`, and `pnpm-lock.yaml`
- `apps/*/package.json` and `packages/*/package.json`
- workspace `tsconfig.json` files and `packages/config-typescript/*`
- source imports, type-only exports, tRPC type imports, and React consumers
- root tests in `tests/`, setup/bootstrap scripts, docs, and `.agents/skills/*`

## Edit Sequence

1. Update package manifests first: workspace `name` fields, internal `dependencies`, `devDependencies`, `peerDependencies`, and root scripts or filters that name scoped packages.
2. Update TypeScript configuration next: `extends`, `paths`, references to config presets, and any package export references.
3. Update source imports and type-only exports. Preserve existing import style and do not turn type-only imports into runtime imports.
4. Update tests, scripts, docs, and project-local skill files that mention old package filters, install commands, or scoped package names.
5. Regenerate the lockfile with `pnpm install --lockfile-only`. Prefer PNPM as the lockfile authority instead of hand-editing lockfile keys.
6. Re-run the audit script and `rg` until old-scope hits are either gone or intentionally documented as historical examples.

## Search Patterns

Search both the scoped and unscoped forms. The unscoped form catches filter text, doc prose, generated-app examples, and helper names that may not include `@`.

Use package-aware replacements. Do not blindly replace every unscoped occurrence if it would alter unrelated product names, file paths, or historical notes that are intentionally not package references.

## Verification

Run the smallest checks that prove the rename is complete:

```bash
node .agents/skills/template-scope-renamer/scripts/audit-scope-references.mjs OLD_SCOPE . --include-unscoped
pnpm install --lockfile-only
pnpm lint
pnpm typecheck
pnpm test
```

If the audit still reports hits, classify each one before completion:

- fix it if it is an active package identity, import, config path, lockfile entry, command, or doc example
- keep it only if it is intentionally historical and the final handoff names the file and reason

Do not run `pnpm dev`, `pnpm start`, or workspace `dev` or `start` scripts unless the user explicitly requests it.

## Common Failure Modes

- Updating `package.json` names but missing imports, `tsconfig` `paths`, or `extends` references.
- Updating source and manifests but leaving stale `pnpm-lock.yaml` package keys.
- Missing repo-local `.agents/skills/*` instructions that still teach agents the old scope.
- Replacing unscoped text too broadly and accidentally renaming public product copy or unrelated docs.
- Leaving root tests that assert old package filters or old production start commands.
