import { useState } from 'react';
import {
  DayCounter,
  HeatmapGrid,
  StatsRow,
  StreakBadge,
  TaskCard,
  type TaskStatus,
} from '@workspace-starter/ui';
import { AuthGateInner } from '../auth/AuthGate';
import { AppShell } from '../layout/AppNav';
import { TrpcProvider } from '../TrpcProvider';
import { trpc } from '../../lib/trpc';

const RULES = [
  'Follow a diet — no cheat meals, no alcohol.',
  'Two 45-minute workouts per day — one must be outdoors.',
  'Drink 1 gallon (3.8L) of water daily.',
  'Read 10 pages of a non-fiction book.',
  'Take a progress photo every day.',
];

function activityStatus(
  log: {
    state: string | null;
    tier: string | null;
    value: number | null;
    subPoints: Record<string, string> | null;
  } | null,
  canEdit: boolean,
): TaskStatus {
  if (!log || log.state === 'UNLOGGED' || log.state === null) {
    const logged =
      log?.tier != null ||
      log?.value != null ||
      (log?.subPoints != null && Object.keys(log.subPoints).length > 0);
    if (!logged) {
      return canEdit ? 'PENDING' : 'OVERDUE';
    }
  }
  if (log?.state === 'FAILED') {
    return 'REJECTED';
  }
  return 'COMPLETED';
}

function DashboardContent() {
  const [rulesOpen, setRulesOpen] = useState(false);
  const utils = trpc.useUtils();

  const activitiesQuery = trpc.activities.getToday.useQuery();
  const statsQuery = trpc.stats.getDashboard.useQuery();
  const heatmapQuery = trpc.heatmap.get.useQuery();

  const markActivity = trpc.activities.markActivity.useMutation({
    onSuccess: () => {
      void utils.activities.getToday.invalidate();
      void utils.stats.getDashboard.invalidate();
    },
  });

  if (activitiesQuery.isLoading || statsQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-black)]">
        <p
          className="text-sm uppercase tracking-[0.3em] text-[var(--text-muted)]"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          Loading dashboard...
        </p>
      </div>
    );
  }

  const stats = statsQuery.data;
  const today = activitiesQuery.data;

  return (
    <div className="min-h-screen bg-[var(--bg-black)] px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <p
              className="text-2xl text-[var(--accent-red)]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              DRCODE
            </p>
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
              75 Hard Challenge
            </p>
          </div>
          {stats && <StreakBadge streak={stats.currentStreak} />}
        </header>

        {stats && (
          <DayCounter
            currentDay={stats.currentDay}
            startDate={stats.startDate}
            estimatedFinishDate={stats.estimatedFinishDate}
          />
        )}

        {today && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2
                className="text-lg uppercase tracking-wider text-[var(--text-muted)]"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                Today&apos;s Activities
              </h2>
              <p
                className="text-sm text-[var(--text-primary)]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {today.dayTotals.netXp} XP
              </p>
            </div>
            {today.scoredActivities.map((activity) => (
              <TaskCard
                key={activity.id}
                icon={activity.emoji ?? '✅'}
                title={activity.title}
                status={activityStatus(activity.log, today.canEdit)}
              >
                {today.canEdit &&
                  activityStatus(activity.log, today.canEdit) !==
                    'COMPLETED' && (
                    <button
                      type="button"
                      disabled={markActivity.isPending}
                      onClick={() =>
                        markActivity.mutate({ activityId: activity.id })
                      }
                      className="w-full rounded bg-[var(--accent-red)] px-4 py-3 text-sm font-semibold uppercase tracking-wider text-white transition hover:opacity-90 disabled:opacity-50"
                    >
                      {markActivity.isPending ? 'Saving...' : 'Mark done'}
                    </button>
                  )}
                {activity.log && activity.log.xpAwarded !== 0 && (
                  <p className="text-xs text-[var(--success)]">
                    {activity.log.xpAwarded > 0 ? '+' : ''}
                    {activity.log.xpAwarded} XP
                  </p>
                )}
              </TaskCard>
            ))}
            {today.personalActivities.length > 0 && (
              <>
                <h3 className="pt-2 text-sm uppercase tracking-wider text-[var(--text-muted)]">
                  Personal
                </h3>
                {today.personalActivities.map((activity) => (
                  <TaskCard
                    key={activity.id}
                    icon={activity.emoji ?? '✅'}
                    title={activity.title}
                    status={activityStatus(activity.log, today.canEdit)}
                  >
                    {today.canEdit &&
                      activityStatus(activity.log, today.canEdit) !==
                        'COMPLETED' && (
                        <button
                          type="button"
                          disabled={markActivity.isPending}
                          onClick={() =>
                            markActivity.mutate({ activityId: activity.id })
                          }
                          className="w-full rounded border border-[var(--border)] px-4 py-2 text-sm uppercase tracking-wider text-[var(--text-primary)] transition hover:border-[var(--accent-red)] disabled:opacity-50"
                        >
                          Mark done
                        </button>
                      )}
                  </TaskCard>
                ))}
              </>
            )}
          </section>
        )}

        {stats && (
          <section>
            <h2
              className="mb-4 text-lg uppercase tracking-wider text-[var(--text-muted)]"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              Consistency
            </h2>
            <StatsRow
              currentStreak={stats.currentStreak}
              longestStreak={stats.longestStreak}
              totalDaysCompleted={stats.totalDaysCompleted}
              successRate={stats.successRate}
              timesRestarted={stats.timesRestarted}
            />
          </section>
        )}

        {heatmapQuery.data && (
          <section>
            <h2
              className="mb-4 text-lg uppercase tracking-wider text-[var(--text-muted)]"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              75-Day Progress
            </h2>
            <HeatmapGrid cells={heatmapQuery.data.cells} />
          </section>
        )}

        <section>
          <button
            type="button"
            onClick={() => setRulesOpen((open) => !open)}
            className="flex w-full items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left text-sm uppercase tracking-wider text-[var(--text-primary)]"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            The 5 Rules
            <span className="text-[var(--text-muted)]">
              {rulesOpen ? '−' : '+'}
            </span>
          </button>
          {rulesOpen && (
            <ol className="mt-3 space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-6 py-4 text-sm text-[var(--text-muted)]">
              {RULES.map((rule) => (
                <li key={rule} className="list-decimal">
                  <span className="text-[var(--text-primary)]">{rule}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <footer className="text-center">
          <a
            href="/join"
            className="text-xs uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--accent-red)]"
          >
            Manage group →
          </a>
        </footer>
      </div>
    </div>
  );
}

export function DashboardPage({ currentPath }: { currentPath?: string }) {
  return (
    <TrpcProvider>
      <AuthGateInner>
        <AppShell currentPath={currentPath}>
          <DashboardContent />
        </AppShell>
      </AuthGateInner>
    </TrpcProvider>
  );
}
