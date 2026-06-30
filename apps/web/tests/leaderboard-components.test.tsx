import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LeaderboardTable } from '@workspace-starter/ui';

describe('LeaderboardTable', () => {
  it('renders member avatar image when avatarUrl is present', () => {
    const { container } = render(
      <LeaderboardTable
        members={[
          {
            rank: 1,
            id: 'user-1',
            name: 'Alex',
            avatarUrl: 'http://localhost:3001/uploads/abc.jpg',
            currentDay: 5,
            status: 'ACTIVE',
            streak: 3,
            xp: 100,
            successRate: 80,
          },
        ]}
        sortBy="xp"
        onSortChange={vi.fn()}
      />,
    );

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('src', 'http://localhost:3001/uploads/abc.jpg');
  });
});
