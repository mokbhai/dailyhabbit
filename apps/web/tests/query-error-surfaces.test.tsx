import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DashboardContent } from '../src/components/dashboard/DashboardPage';
import { ManageGroupContent } from '../src/components/groups/ManageGroupPage';
import { LeaderboardContent } from '../src/components/leaderboard/LeaderboardPage';
import { ProgressContent } from '../src/components/progress/ProgressPage';

const mockActivitiesGetToday = vi.fn();
const mockStatsGetDashboard = vi.fn();
const mockHeatmapGet = vi.fn();
const mockStatsActivitySeries = vi.fn();
const mockStatsActivityCompletion = vi.fn();
const mockLeaderboardGet = vi.fn();
const mockLeaderboardSeries = vi.fn();
const mockGroupsGetMine = vi.fn();
const mockAuthMe = vi.fn();
const mockUseMutation = vi.fn((..._args: unknown[]) => ({
  mutate: vi.fn(),
  isPending: false,
}));
const mockInvalidate = vi.fn();

vi.mock('../src/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({
      activities: {
        getToday: {
          cancel: vi.fn(),
          getData: vi.fn(),
          invalidate: mockInvalidate,
          setData: vi.fn(),
        },
      },
      groups: {
        getMine: {
          invalidate: mockInvalidate,
        },
      },
      stats: {
        getDashboard: {
          invalidate: mockInvalidate,
        },
      },
    }),
    activities: {
      getToday: {
        useQuery: (...args: unknown[]) => mockActivitiesGetToday(...args),
      },
      markActivity: {
        useMutation: (...args: unknown[]) => mockUseMutation(...args),
      },
      undoActivity: {
        useMutation: (...args: unknown[]) => mockUseMutation(...args),
      },
      logNumber: {
        useMutation: (...args: unknown[]) => mockUseMutation(...args),
      },
      setTier: {
        useMutation: (...args: unknown[]) => mockUseMutation(...args),
      },
      setSubPoints: {
        useMutation: (...args: unknown[]) => mockUseMutation(...args),
      },
      attachProof: {
        useMutation: (...args: unknown[]) => mockUseMutation(...args),
      },
    },
    stats: {
      getDashboard: {
        useQuery: (...args: unknown[]) => mockStatsGetDashboard(...args),
      },
      activitySeries: {
        useQuery: (...args: unknown[]) => mockStatsActivitySeries(...args),
      },
      activityCompletion: {
        useQuery: (...args: unknown[]) => mockStatsActivityCompletion(...args),
      },
    },
    heatmap: {
      get: {
        useQuery: (...args: unknown[]) => mockHeatmapGet(...args),
      },
    },
    leaderboard: {
      get: {
        useQuery: (...args: unknown[]) => mockLeaderboardGet(...args),
      },
      series: {
        useQuery: (...args: unknown[]) => mockLeaderboardSeries(...args),
      },
    },
    groups: {
      getMine: {
        useQuery: (...args: unknown[]) => mockGroupsGetMine(...args),
      },
      create: {
        useMutation: (...args: unknown[]) => mockUseMutation(...args),
      },
      regenerateInvite: {
        useMutation: (...args: unknown[]) => mockUseMutation(...args),
      },
      removeMember: {
        useMutation: (...args: unknown[]) => mockUseMutation(...args),
      },
      transferAdmin: {
        useMutation: (...args: unknown[]) => mockUseMutation(...args),
      },
    },
    auth: {
      me: {
        useQuery: (...args: unknown[]) => mockAuthMe(...args),
      },
    },
    guidance: {
      ask: {
        useMutation: (...args: unknown[]) => mockUseMutation(...args),
      },
    },
  },
}));

afterEach(() => {
  vi.restoreAllMocks();
  mockActivitiesGetToday.mockReset();
  mockStatsGetDashboard.mockReset();
  mockHeatmapGet.mockReset();
  mockStatsActivitySeries.mockReset();
  mockStatsActivityCompletion.mockReset();
  mockLeaderboardGet.mockReset();
  mockLeaderboardSeries.mockReset();
  mockGroupsGetMine.mockReset();
  mockAuthMe.mockReset();
  mockUseMutation.mockClear();
  mockInvalidate.mockClear();
});

function idleQuery(data: unknown = undefined) {
  return {
    data,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  };
}

function errorQuery(message: string, refetch = vi.fn()) {
  return {
    data: undefined,
    isLoading: false,
    isError: true,
    error: { message },
    refetch,
  };
}

const dashboardStats = {
  currentDay: 4,
  lengthDays: 30,
  startDate: new Date('2026-06-01T00:00:00.000Z'),
  estimatedFinishDate: new Date('2026-06-30T00:00:00.000Z'),
  todayDate: new Date('2026-06-04T00:00:00.000Z'),
  totalXp: 100,
  todayNetXp: 10,
  currentStreak: 3,
  longestStreak: 3,
  successRate: 75,
};

const emptyToday = {
  scoredActivities: [],
  personalActivities: [],
  dayTotals: {
    netXp: 0,
    personalXp: 0,
  },
  canEdit: true,
};

describe('query error surfaces', () => {
  it('distinguishes Manage Group load errors from the no-group state', async () => {
    const refetch = vi.fn();
    mockGroupsGetMine.mockReturnValue(
      errorQuery('Unable to load group', refetch),
    );

    render(<ManageGroupContent />);

    expect(screen.getByText('Unable to load group')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /create your squad/i }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('offers retry when the leaderboard query fails', async () => {
    const refetch = vi.fn();
    mockAuthMe.mockReturnValue(idleQuery({ user: { id: 'user-1' } }));
    mockLeaderboardGet.mockReturnValue(
      errorQuery('Unable to load leaderboard', refetch),
    );

    render(<LeaderboardContent />);

    expect(screen.getByText('Unable to load leaderboard')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /join a group/i })).toHaveAttribute(
      'href',
      '/join',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('offers retry when the dashboard heatmap query fails', async () => {
    const refetch = vi.fn();
    mockActivitiesGetToday.mockReturnValue(idleQuery(emptyToday));
    mockStatsGetDashboard.mockReturnValue(idleQuery(dashboardStats));
    mockHeatmapGet.mockReturnValue(
      errorQuery('Unable to load heatmap', refetch),
    );

    render(<DashboardContent />);

    expect(screen.getByText('Unable to load heatmap')).toBeInTheDocument();
    expect(screen.getByText('30-Day Progress')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('offers retry when a progress activity chart query fails', async () => {
    const refetch = vi.fn();
    mockActivitiesGetToday.mockReturnValue(
      idleQuery({
        scoredActivities: [
          {
            id: 'activity-1',
            title: 'Pushups',
            emoji: null,
            kind: 'NUMBER',
          },
        ],
        personalActivities: [],
      }),
    );
    mockStatsGetDashboard.mockReturnValue(idleQuery(dashboardStats));
    mockStatsActivitySeries.mockReturnValue(
      errorQuery('Unable to load chart', refetch),
    );
    mockStatsActivityCompletion.mockReturnValue(idleQuery());
    mockLeaderboardSeries.mockReturnValue(
      idleQuery({
        members: [],
      }),
    );

    render(<ProgressContent />);

    expect(screen.getByText('Unable to load chart')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalledOnce();
  });
});
