import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@workspace-starter/api';

const apiUrl = import.meta.env.PUBLIC_API_URL ?? 'http://localhost:3001';

// ── React islands client (use inside .tsx components with React Query) ────
export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${apiUrl}/trpc`,
    }),
  ],
});

// ── Vanilla client (use in .astro server-side scripts or plain TS) ────────
export const trpcVanilla = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${apiUrl}/trpc`,
    }),
  ],
});
