# PNPM Turbo Workspace Starter

Stop spending the first stretch of a new project wiring the same architecture from scratch.

This starter gives you a full-stack TypeScript monorepo with the core pieces already connected: an Astro + React web app, a NestJS + tRPC API, shared UI, shared types, shared i18n helpers, reusable TypeScript configs, Turborepo task orchestration, Git hooks, and CI checks.

![A developer surrounded by messy setup work that resolves into a clean monorepo architecture board.](./docs/assets/template-architecture-pain.png)

## Why This Exists

Setting up a serious app from a blank folder usually means making a pile of early decisions before the product work even starts:

- How should apps and packages be split?
- How should the frontend talk to the backend?
- Where do shared contracts live?
- How do local packages stay linked without version drift?
- Which commands should run in CI, Git hooks, and local development?
- How do you keep the setup easy to rename for the next project?

This template answers those questions with a small, working baseline. It is opinionated enough to be useful, but not so heavy that you have to fight it.

## What's Inside

```text
apps/
  web            Astro + React showcase app
  secondary-web  Second Astro app for deployment strategy testing
  web-host       Node static host that serves both Astro builds
  api            NestJS + tRPC sample API
packages/
  ui             Shared React UI components
  types          Shared types and contracts
  i18n           Shared localization helpers and validation
  config-typescript  Reusable tsconfig presets
```

The sample app is intentionally real enough to prove the architecture:

- The web app imports shared UI and i18n packages.
- React islands call the typed tRPC API.
- Frontend and backend code share contracts through workspace packages.
- Internal dependencies use `workspace:*` instead of duplicated package versions.
- Turborepo runs build, lint, typecheck, and test tasks across the graph.

## Stack

- PNPM workspaces
- Turborepo
- Astro + React
- NestJS + Fastify
- tRPC
- React Query
- TypeScript
- Tailwind CSS
- Node test runner and Vitest
- ESLint and Prettier
- Git hooks and GitHub Actions

## Getting Started

Use Node `>=22.13.0` and the pinned package manager, `pnpm@11.1.3`.

```bash
pnpm install
pnpm dev
```

Default local ports:

- Web: `http://127.0.0.1:4321`
- API: `http://localhost:3001`

For a production-style local run:

```bash
pnpm start
```

`pnpm start` builds the workspace, stages every Astro frontend into the web host, then launches the web host and API production servers together — the same topology as production. The web host serves the primary frontend (`web`) at `/` and every other frontend under its directory name (e.g. `secondary-web` at `/secondary-web`).

See [docs/guides/deployment.md](docs/guides/deployment.md) for how frontends and backends are built, published, and deployed.

## One-Command Bootstrap

Create a fresh project from the starter:

```bash
curl -fsSL https://raw.githubusercontent.com/mokbhai/monorepo-astro-nestjs/main/scripts/bootstrap.sh | bash -s -- my-app
```

The bootstrap flow:

- clones this starter into a fresh directory
- launches an interactive TUI installer
- renames the root package
- runs `pnpm install`
- removes the starter Git history
- removes the bootstrap installer files before commit
- initializes a fresh Git repository
- creates the first commit automatically

## Common Commands

```bash
pnpm dev
pnpm start
pnpm build:frontends
pnpm setup:starter
pnpm template:remove-web-apps:dry-run
pnpm template:remove-web-apps -- --yes
pnpm build
pnpm lint
pnpm format
pnpm format:check
pnpm typecheck
pnpm test
pnpm verify:fast
pnpm verify
pnpm hooks:install
```

Useful workspace-focused commands:

```bash
pnpm --filter @workspace-starter/web dev
pnpm --filter @workspace-starter/secondary-web dev
pnpm --filter @workspace-starter/web-host start
pnpm --filter @workspace-starter/api dev
pnpm --filter @workspace-starter/ui build
pnpm --filter @workspace-starter/i18n test
```

Useful Docker commands:

```bash
docker compose up --build
```

The compose file runs two services: the **web host** (one image bundling every Astro frontend, served from one origin) and the **API**. Add a backend by giving it an `apps/<name>/Dockerfile`; it then builds and deploys as its own image. See [docs/guides/deployment.md](docs/guides/deployment.md).

## Quality Gates

Run this once per checkout to use the repository hooks:

```bash
pnpm hooks:install
```

- `pre-commit` runs `pnpm verify:fast`, which checks lint, formatting, types, and whitespace errors.
- `pre-push` runs `pnpm verify`, which adds the full build and test suite.
- GitHub Actions runs `pnpm verify` on pull requests and pushes to `main`.

## Customizing The Template

This starter uses the scope `@workspace-starter/*`. Replace it with your own project or organization scope in package manifests, imports, TypeScript path aliases, and docs examples.

The included homepage is a showcase page. Once the repo structure is in place, replace it with your product UI and keep the workspace boundaries.

If you want to start with your own frontend instead of the bundled web examples, use `pnpm template:remove-web-apps:dry-run` and then `pnpm template:remove-web-apps -- --yes`. That removes `apps/web`, `apps/secondary-web`, and `apps/web-host`, then rewrites the root production start script and stock Docker Compose files to API-only.

## Guides

- [PNPM workspace guide](./docs/guides/pnpm-workspace.md)
- [Turborepo guide](./docs/guides/turborepo.md)
- [Template customization guide](./docs/guides/customizing-the-template.md)

## Suggested Workflow

1. Install dependencies with `pnpm install`.
2. Run the workspace with `pnpm dev`.
3. Explore the web app, API, and shared packages.
4. Rename the scope and packages for your project.
5. Run `pnpm verify:fast` before committing.
6. Add new apps or packages as the monorepo grows.
