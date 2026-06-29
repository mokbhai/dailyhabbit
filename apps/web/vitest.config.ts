import { getViteConfig } from 'astro/config';

type VitestAstroConfig = Parameters<typeof getViteConfig>[0] & {
  test: {
    environment: 'jsdom';
    include: string[];
    restoreMocks: boolean;
    setupFiles: string[];
  };
};

const config = {
  test: {
    environment: 'jsdom',
    include: [
      'tests/**/*.{test,spec}.{ts,tsx}',
      'src/**/*.{test,spec}.{ts,tsx}',
    ],
    restoreMocks: true,
    setupFiles: ['./tests/setup.ts'],
  },
} satisfies VitestAstroConfig;

export default getViteConfig(config as Parameters<typeof getViteConfig>[0]);
