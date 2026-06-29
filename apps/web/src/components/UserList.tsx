import { trpc } from '../lib/trpc';

interface UserListMessages {
  loading: string;
  error: string;
  empty: string;
  badge: string;
}

// Example React island — shows how to call the tRPC API from the frontend.
// Use with <UserList client:load /> in an .astro file.
export function UserList({
  messages,
  variant = 'light',
}: {
  messages: UserListMessages;
  variant?: 'light' | 'dark';
}) {
  const { data: users, isLoading, error } = trpc.users.list.useQuery();

  if (isLoading) {
    return (
      <div className="grid gap-3" aria-label={messages.loading}>
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className={[
              'h-16 animate-pulse border-b bg-gradient-to-r',
              variant === 'dark'
                ? 'border-white/12 from-transparent via-white/8 to-transparent'
                : 'border-slate-200/80 from-transparent via-slate-100 to-transparent',
            ].join(' ')}
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p
        className={[
          'border-l pl-4 text-sm leading-7',
          variant === 'dark'
            ? 'border-rose-400/50 text-rose-200'
            : 'border-rose-300 text-rose-700',
        ].join(' ')}
      >
        {messages.error}
      </p>
    );
  }

  if (!users?.length) {
    return (
      <p
        className={[
          'border-l pl-4 text-sm leading-7',
          variant === 'dark'
            ? 'border-white/18 text-white/64'
            : 'border-slate-300 text-slate-600',
        ].join(' ')}
      >
        {messages.empty}
      </p>
    );
  }

  return (
    <ul className="grid gap-3">
      {users?.map((user) => (
        <li
          key={user.id}
          className={[
            'flex items-start justify-between gap-4 border-b pb-3 last:border-b-0 last:pb-0',
            variant === 'dark' ? 'border-white/12' : 'border-slate-200/80',
          ].join(' ')}
        >
          <div>
            <p
              className={[
                'text-sm font-semibold',
                variant === 'dark' ? 'text-white' : 'text-slate-900',
              ].join(' ')}
            >
              {user.name}
            </p>
            <p
              className={[
                'truncate text-sm',
                variant === 'dark' ? 'text-white/58' : 'text-slate-500',
              ].join(' ')}
            >
              {user.email}
            </p>
          </div>
          <span
            className={[
              'text-[10px] font-semibold uppercase tracking-[0.24em]',
              variant === 'dark' ? 'text-white/34' : 'text-slate-400',
            ].join(' ')}
          >
            {messages.badge}
          </span>
        </li>
      ))}
    </ul>
  );
}
