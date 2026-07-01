# Production Start E2E Sweep

Date: 2026-07-01

Setup (first run only): `pnpm e2e:install` to download the Chromium browser
Playwright drives. On Linux CI, use `pnpm exec playwright install --with-deps
chromium` to also pull system dependencies.

Command: `pnpm e2e`

The automated sweep boots the app through the real root `pnpm start` command
against a throwaway SQLite database and runs a Chromium Playwright spec split
into serial blocks that share isolated browser contexts, so each block keeps its
own per-test timeout budget while the app boots only once.

## Automated Coverage

- Auth: phone registration with the `+91` UI prefix for three users.
- Groups: admin creates a group, copies the invite URL, member joins via invite,
  and the member appears in the admin's group list.
- Today: seeded sub-point, number, tiered, and checkbox/proof activities are
  exercised from the browser.
- Proof uploads: Progress photo proof upload is surfaced on Today and accepted
  by the authenticated upload route.
- Leaderboard, Progress, History, Gallery: pages are visited after activity
  logging; leaderboard verifies both users, gallery verifies the proof entry.
- Personal-only path: a groupless user creates and logs a personal activity.
- Profile: WhatsApp reminder opt-in toggle and save path are exercised.
- Browser health: the spec fails on unexpected page errors or console errors.

## Remaining Manual Or Follow-Up Coverage

- Full admin activity editing and group heatmap label workflows.
- Remove member, transfer admin, regenerate invite, and leave-group confirm
  branches.
- Avatar upload display and CSV download contents.
- Forced API-failure retry states beyond the unit/component coverage.
- Day finalizer time travel for grouped and personal-only users.
- `pnpm dev` browser sweep. The repeatable suite currently targets
  production `pnpm start`; adding a dev-server variant should be a separate,
  explicit lane because the root dev command is long-running and watcher based.

Known related product issue: #72 tracks History using legacy task labels instead
of real activity names.
