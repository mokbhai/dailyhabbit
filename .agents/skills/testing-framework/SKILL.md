---
name: testing-framework
description: Use when adding, changing, reviewing, or choosing automated tests for the JainParichay template-jp monorepo, including Astro/React frontend tests, NestJS/tRPC backend tests, shared package tests, Playwright end-to-end tests, coverage strategy, test scripts, or test dependency decisions.
---

# Testing Framework

Use this skill to keep frontend, backend, and full-stack tests consistent across the PNPM/Turbo workspace.

## Recommended Stack

Default to a layered test strategy:

- **Vitest** for TypeScript unit tests, component tests, and backend integration tests. It fits the Astro/Vite/ESM stack, supports TS/JSX without a separate Jest transform pipeline, and can run Node-environment backend tests.
- **React Testing Library** for React island and shared UI component tests. Assert accessible user-visible behavior rather than component internals.
- **Astro Container API** for focused `.astro` component rendering tests when static/server-rendered Astro behavior matters. Treat experimental APIs carefully and avoid using them for full page journeys.
- **Nest testing utilities plus Fastify `inject()`** for HTTP-level API tests that need Nest DI, middleware, CORS, or adapter behavior.
- **tRPC callers** for most router/procedure tests. Prefer direct procedure tests over HTTP when the behavior under test is input validation, authorization, returned data, or error shape.
- **Playwright** for high-value browser end-to-end tests that prove routing, hydration, API connectivity, i18n navigation, auth redirects, or critical user journeys in a real browser.

Keep existing `node:test` repository guardrail tests unless the task is explicitly to migrate them. New TS application tests should generally use Vitest.

## Decision Rules

Choose the narrowest test type that can catch the bug or regression:

- Pure functions, zod schemas, i18n utilities, shared types, and small services: Vitest unit tests.
- React components and UI package components: Vitest with React Testing Library, `jsdom` or equivalent DOM environment, and user-event for interactions.
- Astro content/config/rendering: Vitest with Astro's `getViteConfig()` and, when needed, Astro Container API.
- tRPC procedures: Vitest with a direct caller created from the router and an explicit test context.
- Nest module wiring, CORS, Fastify adapter behavior, or request/response behavior: Vitest with `@nestjs/testing`, `FastifyAdapter`, and `app.getHttpAdapter().getInstance().inject()`.
- Web plus API behavior visible only in a browser: Playwright.

Push back on requests to cover everything with Playwright or browser tests. Large teams generally keep most checks below the browser layer because browser suites are slower, costlier, and more failure-prone. Add a browser test only when lower-level tests would miss the integration risk.

## Repository Placement

Respect existing workspace ownership:

- Root `tests/*.test.mjs`: repository guardrails and setup-script behavior that is intentionally framework-light.
- `apps/api/tests/` or colocated `*.test.ts`: backend router, service, Nest module, and HTTP integration tests.
- `apps/web/tests/` or colocated `*.test.ts(x)`: Astro, React island, data loading, and web-specific tests.
- `packages/*/tests/` or colocated `*.test.ts(x)`: package contracts and reusable utilities.
- `tests/e2e/` with a root Playwright config: full-stack browser tests that may coordinate more than one workspace.

When adding shared test dependencies, prefer catalog entries in `pnpm-workspace.yaml` and package-level `devDependencies`. Keep root scripts as aggregators; package scripts should own their own focused test commands.

## Implementation Flow

1. Identify the risk being protected: logic, contract, rendering, API integration, browser journey, or regression.
2. Search existing tests and scripts with `rg` before adding new conventions.
3. Choose the narrowest layer from the decision rules.
4. Add only the dependencies required for that layer. Do not introduce Jest, Cypress, Selenium, or MSW unless there is a concrete project need that Vitest/Testing Library/Playwright does not cover.
5. Add or update the package `test` script so `turbo test` can discover it. Preserve the root `pnpm test` aggregation behavior.
6. Keep fixtures small and explicit. Prefer builders/helpers only after two or more tests duplicate meaningful setup.
7. Test public behavior and contracts. Avoid assertions on React state internals, implementation-only class names, generated IDs, or incidental ordering unless that ordering is a contract.
8. Make tests deterministic under retries and parallel runs. Isolate env vars, mock clocks/randomness when needed, close Nest apps, and avoid shared mutable global state.

## Backend Patterns

For tRPC procedure tests, create a caller with an explicit context and assert success, validation failures, authorization failures, and edge cases close to the procedure. Do not boot an HTTP server just to test procedure logic.

For Nest/Fastify integration tests, use `@nestjs/testing` to compile the module, create a `NestFastifyApplication` with `FastifyAdapter`, call `app.init()`, wait for `app.getHttpAdapter().getInstance().ready()`, exercise requests with Fastify `inject()`, and always close the app in cleanup.

When protected procedures are involved, verify both authenticated and unauthenticated paths. Do not call a procedure "secure" if the test context uses a fake user while runtime auth in `context.ts` is still placeholder-only.

## Frontend Patterns

For React tests, render components with the same providers they need in production. Prefer accessible queries such as role, label, and visible text. Use test IDs only when the UI has no stable semantic selector.

For tRPC-powered components, prefer extracting pure display states where practical, then test the data-bound component with a small typed test client or narrow boundary mock. Do not assert React Query cache internals.

For Astro page behavior, prefer lower-level tests for generated content, locale catalogs, and helper logic. Use Playwright when the risk depends on actual routing, hydration, browser APIs, or client/server integration.

## Playwright Rules

Playwright tests should be few, stable, and user-journey oriented:

- Use locators by role, label, and accessible name.
- Keep each test isolated; do not depend on test order.
- Prefer production-like builds or preview servers for release confidence.
- Capture traces, screenshots, and videos on failure when configuring CI.
- Avoid fixed sleeps. Let Playwright auto-wait through locators and assertions.

Do not run long-lived `pnpm dev`, `pnpm start`, or workspace `dev`/`start` commands unless the user explicitly requests it. If local browser validation is needed, prefer a short-lived Playwright-managed server such as a built preview command.

## Coverage And Validation

Do not chase a global coverage number before the suite has meaningful tests. Start with risk-based coverage for contracts, edge cases, error paths, and user-visible regressions. Add thresholds later only when they reinforce quality instead of encouraging shallow assertions.

Before handing off test work, run the narrowest reliable checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

For focused changes, package-level checks are acceptable when they cover the touched surface, but name any skipped broader checks and why.
