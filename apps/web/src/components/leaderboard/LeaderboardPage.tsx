import { useState } from 'react';
import {
  LeaderboardTable,
  PodiumBlock,
  type LeaderboardSortBy,
} from '@workspace-starter/ui';
import { AuthGateInner } from '../auth/AuthGate';
import { AuthenticatedImage } from '../common/AuthenticatedImage';
import { AppShell } from '../layout/AppNav';
import { TrpcProvider } from '../TrpcProvider';
import { trpc } from '../../lib/trpc';

type LeaderboardWindow = 'today' | 'week' | 'total';

const WINDOW_OPTIONS: { value: LeaderboardWindow; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'total', label: 'Total' },
];

function LeaderboardContent() {
  const [sortBy, setSortBy] = useState<LeaderboardSortBy>('xp');
  const [window, setWindow] = useState<LeaderboardWindow>('today');
  const me = trpc.auth.me.useQuery();

  const leaderboard = trpc.leaderboard.get.useQuery(
    { window, sortBy },
    { refetchInterval: 60_000 },
  );

  if (leaderboard.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm uppercase tracking-[0.3em] text-[var(--text-muted)]">
          Loading leaderboard...
        </p>
      </div>
    );
  }

  if (leaderboard.isError) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center">
        <p className="text-[var(--accent-red)]">{leaderboard.error.message}</p>
        <a
          href="/join"
          className="mt-4 inline-block text-sm text-[var(--text-muted)] hover:text-[var(--accent-red)]"
        >
          Join a group →
        </a>
      </div>
    );
  }

  const data = leaderboard.data!;

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <header>
        <h1
          className="text-3xl text-[var(--text-primary)] sm:text-4xl"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Leaderboard
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          Squad rankings · refreshes every 60s
        </p>
      </header>

      <div
        className="flex gap-2"
        role="tablist"
        aria-label="Leaderboard time window"
      >
        {WINDOW_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={window === option.value}
            onClick={() => setWindow(option.value)}
            className={
              window === option.value
                ? 'rounded-full border border-[var(--accent-red)] bg-[var(--accent-red)]/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--accent-red)]'
                : 'rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] transition hover:border-[var(--accent-red)]/50 hover:text-[var(--text-primary)]'
            }
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {option.label}
          </button>
        ))}
      </div>

      {data.podium.length > 0 && <PodiumBlock podium={data.podium} />}

      <LeaderboardTable
        members={data.members}
        sortBy={sortBy}
        onSortChange={setSortBy}
        highlightUserId={me.data?.user.id}
        renderAvatar={(member) =>
          member.avatarUrl ? (
            <AuthenticatedImage
              src={member.avatarUrl}
              alt=""
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            member.name.charAt(0).toUpperCase()
          )
        }
      />
    </div>
  );
}

type LeaderboardPageProps = {
  currentPath?: string;
};

export function LeaderboardPage({ currentPath }: LeaderboardPageProps) {
  return (
    <TrpcProvider>
      <AuthGateInner>
        <AppShell currentPath={currentPath}>
          <LeaderboardContent />
        </AppShell>
      </AuthGateInner>
    </TrpcProvider>
  );
}
