import { render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthGateInner } from '../src/components/auth/AuthGate';

const mockMeUseQuery = vi.fn();

vi.mock('../src/components/TrpcProvider', () => ({
  TrpcProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('../src/lib/trpc', () => ({
  trpc: {
    auth: {
      me: {
        useQuery: (...args: unknown[]) => mockMeUseQuery(...args),
      },
    },
  },
}));

function stubLocation(options: { pathname?: string; search?: string }): {
  href: string;
} {
  let locationHref = '';
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      get href() {
        return locationHref;
      },
      set href(value: string) {
        locationHref = value;
      },
      pathname: options.pathname ?? '/',
      search: options.search ?? '',
    },
  });
  return {
    get href() {
      return locationHref;
    },
  };
}

describe('AuthGateInner', () => {
  beforeEach(() => {
    mockMeUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockMeUseQuery.mockReset();
  });

  it('redirects to login with returnTo when on a protected path', async () => {
    const location = stubLocation({ pathname: '/gallery' });

    render(
      <AuthGateInner>
        <div>Protected</div>
      </AuthGateInner>,
    );

    await waitFor(() => {
      expect(location.href).toBe('/?returnTo=%2Fgallery');
    });
  });

  it('encodes full path and search in returnTo', async () => {
    const location = stubLocation({
      pathname: '/gallery',
      search: '?foo=bar',
    });

    render(
      <AuthGateInner>
        <div>Protected</div>
      </AuthGateInner>,
    );

    await waitFor(() => {
      expect(location.href).toBe('/?returnTo=%2Fgallery%3Ffoo%3Dbar');
    });
  });

  it('preserves an existing returnTo query param without double-wrapping', async () => {
    const location = stubLocation({
      pathname: '/',
      search: '?returnTo=/history',
    });

    render(
      <AuthGateInner>
        <div>Protected</div>
      </AuthGateInner>,
    );

    await waitFor(() => {
      expect(location.href).toBe('/?returnTo=%2Fhistory');
    });
  });

  it('redirects to / when already on / with no returnTo', async () => {
    const location = stubLocation({ pathname: '/', search: '' });

    render(
      <AuthGateInner>
        <div>Protected</div>
      </AuthGateInner>,
    );

    await waitFor(() => {
      expect(location.href).toBe('/');
    });
  });
});
