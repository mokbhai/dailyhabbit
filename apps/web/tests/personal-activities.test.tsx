import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PersonalActivitiesSection } from '../src/components/activities/PersonalActivitiesSection';

const mockListMyPersonalActivities = vi.fn();
const mockUseMutation = vi.fn(() => ({
  mutate: vi.fn(),
  isPending: false,
  error: null,
}));
const mockInvalidate = vi.fn();

vi.mock('../src/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({
      activities: {
        listMyPersonalActivities: {
          invalidate: mockInvalidate,
        },
      },
    }),
    activities: {
      listMyPersonalActivities: {
        useQuery: (...args: unknown[]) => mockListMyPersonalActivities(...args),
      },
      createPersonalActivity: {
        useMutation: () => mockUseMutation(),
      },
      updatePersonalActivity: {
        useMutation: () => mockUseMutation(),
      },
      archivePersonalActivity: {
        useMutation: () => mockUseMutation(),
      },
    },
  },
}));

afterEach(() => {
  vi.restoreAllMocks();
  mockListMyPersonalActivities.mockReset();
  mockUseMutation.mockClear();
  mockInvalidate.mockClear();
});

describe('PersonalActivitiesSection', () => {
  it('shows error state with retry when query fails', async () => {
    const refetch = vi.fn();
    mockListMyPersonalActivities.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { message: 'Failed to load personal activities' },
      refetch,
    });

    render(<PersonalActivitiesSection />);

    expect(
      screen.getByText('Failed to load personal activities'),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalledOnce();
  });
});
