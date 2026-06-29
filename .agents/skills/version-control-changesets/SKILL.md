---
name: version-control-changesets
description: Use when finalizing version-control hygiene, commits, release notes, or Changesets entries in the JainParichay template-jp PNPM/Turbo monorepo, especially after changes to apps/*, packages/*, exported APIs, public types, shared UI components, workspace dependencies, build scripts, release scripts, or package manifests.
---

# Version Control Changesets

Use this skill to keep git state, validation, and Changesets decisions predictable before handoff, review, or commit.

## Start With Git State

Before editing or finalizing, inspect the real working tree:

- Run `git status --short` and separate intended changes from pre-existing user changes.
- Use `git diff -- <path>` or `git diff --stat` to understand touched files before staging, committing, or summarizing.
- Never revert, overwrite, or restage unrelated user changes. If unrelated changes are in the same file, work around them and mention the overlap.
- Do not create a commit unless the user explicitly asks. When committing, stage only relevant files and use a short imperative, sentence-case subject.

## Changeset Decision

This repo has Changesets configured with `.changeset/config.json` and root scripts:

- `pnpm changeset`
- `pnpm version-packages`
- `pnpm release`

Add or update a changeset in the same PR when a change affects consumer-visible behavior or release output for a workspace in `apps/*` or `packages/*`:

- exported functions, components, types, package exports, or shared contracts
- app behavior intended to ship as a versioned workspace
- bug fixes users or downstream workspaces rely on
- new backwards-compatible capabilities
- breaking behavior, removed APIs, renamed props, changed defaults, or required migrations
- runtime, peer, or internal workspace dependency changes that affect consumers
- build, config, CLI, release, or package-manifest behavior exposed to downstream users

Usually skip a changeset for tests only, lint/formatting, docs-only edits, internal refactors with no behavior change, or agent/skill metadata changes. If the change only updates repository process but affects release commands or package publishing, add a changeset for the affected workspace if one exists; otherwise document the reason for skipping.

## Choosing Bumps

Use the smallest semver bump that honestly communicates impact:

- `patch`: backwards-compatible bug fix, dependency correction, packaging fix, or small behavior correction.
- `minor`: backwards-compatible new feature or newly exported capability.
- `major`: breaking change, migration requirement, removed or renamed public surface, changed default with meaningful impact.

Select every affected workspace, not only the file directly edited. For example, a shared type change in `@workspace-starter/types` that changes API and web behavior may require entries for the type package and the consuming workspace if the consuming workspace ships a visible change.

## Writing The Changeset

Prefer `pnpm changeset` for new entries. Edit the generated `.changeset/*.md` afterward if needed.

Write the summary for a package consumer or release-note reader:

- State the shipped behavior, not implementation chores.
- Mention migration impact for `major` bumps.
- Keep unrelated changes in separate changesets when they affect different packages or semver levels.
- If a relevant changeset already exists for the same PR, update it instead of adding a duplicate.

## Final Verification

Before saying work is complete:

- Use `pnpm verify:fast` for the standard local pre-commit gate.
- Use `pnpm verify` for guardrail, root-script, CI, Git hook, workspace-manifest, Turbo, package-export, or shared-contract changes when feasible.
- Run the narrowest reliable validation required by `AGENTS.md`: usually `pnpm lint`, `pnpm typecheck`, and targeted tests; use full `pnpm test` for scripts, build behavior, or shared contracts.
- Run `git diff --check` when touching markdown, package manifests, or generated release notes.
- Re-run `git status --short` and include changed files, validation, skipped checks, and changeset status in the final handoff.

If validation cannot run, report the exact command and the reason. Do not imply a changeset was added when the decision was to skip it.

## Related Skills

Use `template-workspace-changes` as well when creating, removing, renaming, moving, or wiring `apps/*` or `packages/*`. Use `trpc-feature-flow` as well when changing tRPC procedures, shared API types, auth behavior, or React tRPC consumers.
