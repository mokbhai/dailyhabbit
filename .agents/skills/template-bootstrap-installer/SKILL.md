---
name: template-bootstrap-installer
description: Use when changing the JainParichay template bootstrap installer, setup flow, root package rename, starter cleanup, installer artifact deletion, git identity handling, first commit behavior, or related docs/tests in scripts/bootstrap.sh, scripts/setup-starter.mjs, scripts/lib/*, README.md, or tests/setup-starter.test.mjs.
---

# Template Bootstrap Installer

## Overview

Use this skill before editing the template bootstrap path. This flow intentionally removes `.git` and installer files, so treat changes as destructive until proven otherwise in a temp fixture.

## Start Here

Restate the intended change, then call out the risky surface area before editing. For larger changes, summarize the approach and explicitly mention which destructive steps are affected.

Read the relevant touchpoints first:

- `scripts/bootstrap.sh` for clone target handling, prerequisites, TTY redirection, and `BOOTSTRAP_*` env behavior.
- `scripts/setup-starter.mjs` for prompts, root package rename, install, `.git` removal, fresh git init, cleanup, and first commit.
- `scripts/lib/*` for package-name validation, command execution, TUI behavior, and artifact removal.
- `README.md` for the public bootstrap command and any docs that would become stale in the generated app.
- `tests/setup-starter.test.mjs` for package rename and cleanup coverage.

## Required Checks

Preserve target directory safety:

- Reject an empty target path or blank prompt response before cloning.
- Reject an existing non-empty target before cloning.
- Allow a new target path or an existing empty target directory.
- Keep non-interactive usage from hanging; when no TTY is available, require explicit input or fail clearly.
- Keep the TTY path explicit through `/dev/tty` only when readable and writable.

Preserve setup flow safety:

- Validate root package names through the existing package-name helper; do not bypass normalization or invalid-name rejection.
- Do not rename workspace package scopes unless the user explicitly asks for that broader migration.
- Resolve git identity before destructive steps. If global `user.name` or `user.email` is absent, prompt in interactive mode or fail clearly before `.git` removal and cleanup in unattended mode.
- Keep first-commit behavior deterministic: configure local repo identity, add intended files, and commit only after installer artifacts are removed.

Preserve deletion scope:

- Never run the real installer against the working repository as a smoke test; use a temp clone or fixture.
- `.git` removal must target only the cloned starter root.
- Installer cleanup must remove only installer-owned artifacts. If adding non-installer files under `scripts/` or `scripts/lib/`, update cleanup logic and tests so those files survive.
- User-facing template commands belong under `scripts/template/` and must survive `pnpm setup:starter`. Keep installer-only helpers under `scripts/lib/`, which cleanup removes.
- Keep `scripts/` removal conditional on the directory being empty.
- Account for stale starter-only docs or commands in the generated app, especially `README.md` bootstrap sections and `package.json` setup scripts.

## Testing Expectations

Add or update focused tests before trusting installer changes:

- Non-empty target rejection happens before clone.
- Empty/new target handling still works.
- TTY and non-TTY bootstrap paths both behave intentionally.
- Missing global git identity does not cause an unclear commit failure after destructive steps.
- Package-name validation rejects invalid names and preserves normalized valid names.
- Artifact cleanup deletes only the intended installer files and preserves unrelated `scripts/` contents.
- README bootstrap command and behavior notes match the actual installer.

Run the smallest meaningful validation, then broaden if the change crosses boundaries:

```bash
bash -n scripts/bootstrap.sh
node --test tests/setup-starter.test.mjs
pnpm test
```

Use `pnpm test` when shared behavior, root scripts, or workspace packages may be affected. If a full destructive bootstrap smoke test is needed, run it only in a temporary directory with a disposable local clone and clearly controlled inputs.

## Common Mistakes

- Deleting all of `scripts/` or `scripts/lib/` after a future change adds reusable project scripts there.
- Making bootstrap depend on an interactive TTY and breaking piped `curl | bash` usage.
- Letting `git commit` fail late because local identity was not configured and global identity was absent.
- Updating installer behavior but leaving the README command, `pnpm setup:starter`, or generated-app docs stale.
- Testing helper functions only and missing the shell handoff between `bootstrap.sh` and `setup-starter.mjs`.
