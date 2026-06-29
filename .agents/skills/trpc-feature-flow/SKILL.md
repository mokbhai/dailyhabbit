---
name: trpc-feature-flow
description: Use when adding or changing tRPC API procedures, authentication behavior, shared API types, web tRPC clients, or React consumers in the JainParichay template-jp monorepo.
---

# tRPC Feature Flow

Use this skill for changes that cross the NestJS tRPC API, shared contracts, Astro/React consumers, or request auth behavior.

## Start With The Contract

Before editing, map the feature boundary and decide what must be public, protected, or shared:

- Public procedures are safe for anonymous callers and use `publicProcedure`.
- Protected procedures require `ctx.user` and use `protectedProcedure`.
- Inputs must be validated with `zod` at the procedure boundary.
- Output shapes should be inferred from procedures unless the same business contract is reused outside tRPC; put those reusable contracts in `packages/types`.
- Do not import API runtime code into `apps/web`. The web app should import `AppRouter` as a type from `@workspace-starter/api`.

If the requested auth model is vague, inspect `apps/api/src/trpc/context.ts` and decide whether the existing placeholder is enough. Do not pretend a protected procedure is secure until `getUserFromRequest` has real JWT/session verification.

## Required Touchpoints

Inspect and update only the touchpoints the feature actually needs:

- `apps/api/src/trpc/router.ts`: add routers/procedures, zod inputs, mutation/query selection, and route nesting.
- `apps/api/src/trpc/trpc.ts`: add or adjust middleware, error formatting, and public/protected procedure helpers.
- `apps/api/src/trpc/context.ts`: add request-scoped services such as `user`, db clients, tenant data, or auth claims.
- `apps/api/src/index.ts`: keep type-only exports for router types consumed by the web app.
- `apps/web/src/lib/trpc.ts`: adjust client links, headers, auth forwarding, or API URL handling.
- React island components in `apps/web/src/components`: use `trpc.<router>.<procedure>.useQuery()` or `useMutation()` behind `TrpcProvider`.
- `packages/types/src/*`: add shared DTO/domain types only when they are reused outside one procedure.
- Environment/CORS files or docs: update `PUBLIC_API_URL` and `CORS_ORIGIN` behavior when new origins, credentials, or auth headers require it.

## Implementation Flow

1. Search current usage with `rg` for the target router, type, component, env var, and auth concept.
2. Add or update shared types first only if the type is reused across backend and frontend outside tRPC inference.
3. Add the API procedure in `router.ts`, using zod schemas close to the procedure and the narrowest input shape that satisfies the feature.
4. Choose `publicProcedure` or `protectedProcedure` deliberately. For protected work, make sure `context.ts` can actually populate the required identity.
5. If frontend requests need auth headers, add them in `apps/web/src/lib/trpc.ts` through the tRPC link configuration rather than per-component ad hoc fetch code.
6. Add or update React islands with explicit loading, error, empty, and success states. Preserve existing component styling conventions and keep the island wrapped in `TrpcProvider`.
7. For mutations, invalidate or update the relevant React Query cache after success instead of relying on a full page reload.
8. Keep API router exposure typed, not runtime-coupled: `apps/api/src/index.ts` should continue exporting `AppRouter` with `export type`.

## Guardrails

- Avoid duplicating zod schemas and TypeScript interfaces unless there is a real cross-package contract. Prefer deriving types from zod where the codebase already does so.
- Do not add a protected procedure without a credible auth source in `context.ts`.
- Do not swallow API errors in React components. Show a user-facing error state and keep enough detail available for debugging.
- Do not bypass the tRPC client with raw `fetch` for tRPC endpoints.
- Do not broaden CORS with `"*"` when credentials or auth headers are involved. Add explicit origins to `CORS_ORIGIN`.
- Keep placeholder demo data obvious with a TODO if the feature is still scaffold-level.

## Verification

Run the smallest checks that prove the changed surface:

```bash
pnpm --filter @workspace-starter/api typecheck
pnpm --filter @workspace-starter/web typecheck
pnpm typecheck
```

Also run `pnpm lint` or focused package lint when changing exported types, router helpers, or React components in a way lint can catch. If auth, CORS, or env behavior changes, smoke test the API and web app together with matching `PUBLIC_API_URL` and `CORS_ORIGIN` values.
