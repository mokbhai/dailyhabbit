import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppNav } from '../src/components/layout/AppNav';

const mockProfileUseQuery = vi.fn();

vi.mock('../src/lib/trpc', () => ({
  trpc: {
    profile: {
      get: {
        useQuery: (...args: unknown[]) => mockProfileUseQuery(...args),
      },
    },
  },
}));

afterEach(() => {
  vi.restoreAllMocks();
  mockProfileUseQuery.mockReset();
});

function renderDesktopNav() {
  render(<AppNav currentPath="/dashboard" />);
  return screen.getAllByRole('navigation')[0];
}

describe('AppNav admin links', () => {
  it('renders admin links when profile.get reports isGroupAdmin', () => {
    mockProfileUseQuery.mockReturnValue({
      data: { isGroupAdmin: true },
      isLoading: false,
      isError: false,
    });

    renderDesktopNav();

    expect(
      screen.getByRole('link', { name: /Edit Activities/i }),
    ).toHaveAttribute('href', '/admin/activities');
    expect(
      screen.getByRole('link', { name: /Group Settings/i }),
    ).toHaveAttribute('href', '/admin/group');
  });

  it('does not render admin links when isGroupAdmin is false', () => {
    mockProfileUseQuery.mockReturnValue({
      data: { isGroupAdmin: false },
      isLoading: false,
      isError: false,
    });

    renderDesktopNav();

    expect(
      screen.queryByRole('link', { name: /Edit Activities/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Group Settings/i }),
    ).not.toBeInTheDocument();
  });

  it('does not render admin links while profile is loading', () => {
    mockProfileUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    renderDesktopNav();

    expect(
      screen.queryByRole('link', { name: /Edit Activities/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Group Settings/i }),
    ).not.toBeInTheDocument();
  });

  it('does not render admin links when profile query errors', () => {
    mockProfileUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    renderDesktopNav();

    expect(
      screen.queryByRole('link', { name: /Edit Activities/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Group Settings/i }),
    ).not.toBeInTheDocument();
  });
});
