import path from 'node:path';
import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

config({ path: path.resolve(__dirname, '../../.env') });

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.ts'],
    restoreMocks: true,
  },
});
