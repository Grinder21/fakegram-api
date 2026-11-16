import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

const local = existsSync('.env.test.local')
  ? parse(readFileSync('.env.test.local'))
  : {};
const development = existsSync('.env') ? parse(readFileSync('.env')) : {};
const explicitUrl = process.env.E2E_DATABASE_URL || local.E2E_DATABASE_URL;
const sourceUrl =
  explicitUrl || process.env.DATABASE_URL || development.DATABASE_URL;
if (!sourceUrl) {
  throw new Error(
    'Set E2E_DATABASE_URL or configure a local DATABASE_URL in .env',
  );
}

let database: URL;
try {
  database = new URL(sourceUrl);
} catch {
  throw new Error('The E2E database connection URL is invalid');
}
if (!explicitUrl) {
  if (!['localhost', '127.0.0.1', '[::1]'].includes(database.hostname)) {
    throw new Error(
      'Set E2E_DATABASE_URL explicitly for a non-local test server',
    );
  }
  database.pathname = '/fakegram_e2e';
}
if (
  !['postgres:', 'postgresql:'].includes(database.protocol) ||
  database.pathname !== '/fakegram_e2e'
) {
  throw new Error('E2E_DATABASE_URL must point to the fakegram_e2e database');
}

export default defineConfig({
  plugins: [swc.vite({ swcrc: false, module: { type: 'es6' } })],
  test: {
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts'],
    setupFiles: ['./test/setup.ts'],
    fileParallelism: false,
    maxWorkers: 1,
    hookTimeout: 30_000,
    testTimeout: 15_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: database.toString(),
      JWT_ACCESS_SECRET: 'fakegram-e2e-only-jwt-secret-at-least-32-characters',
      ACCESS_TOKEN_TTL: '15m',
      REFRESH_TOKEN_TTL_DAYS: '30',
      COOKIE_SECURE: 'false',
      CLIENT_ORIGIN: 'http://localhost:5173',
      PORT: '3000',
    },
  },
});
