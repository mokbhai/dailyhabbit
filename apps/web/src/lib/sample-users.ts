import { trpcVanilla } from './trpc';

export interface SampleUsersState {
  users: Array<{ id: string; name: string; email: string }>;
  available: boolean;
}

export async function getSampleUsers(): Promise<SampleUsersState> {
  try {
    const users = await trpcVanilla.users.list.query();
    return { users, available: true };
  } catch {
    return { users: [], available: false };
  }
}
