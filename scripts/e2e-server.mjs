import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const apiPort = 3001;
const webPort = 4321;

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    });
    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(
        new Error(
          [
            `${command} ${args.join(' ')} failed with ${
              signal ?? `exit ${code}`
            }`,
            stdout.trim() ? `stdout:\n${stdout.trim()}` : '',
            stderr.trim() ? `stderr:\n${stderr.trim()}` : '',
          ]
            .filter(Boolean)
            .join('\n\n'),
        ),
      );
    });
  });
}

function assertPortFree(port, label) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', (error) => {
      reject(
        new Error(
          `${label} port ${port} is not available. Stop the existing process before running pnpm e2e.`,
          { cause: error },
        ),
      );
    });
    server.listen(port, '127.0.0.1', () => {
      server.close(resolve);
    });
  });
}

async function main() {
  await assertPortFree(apiPort, 'API');
  await assertPortFree(webPort, 'Web');

  const tempDir = await mkdtemp(path.join(tmpdir(), 'dailyhabbit-e2e-'));
  // Strip any inherited PORT: the API and web-host each read process.env.PORT
  // with different defaults (3001 vs 4321), so a parent PORT would make them
  // collide or bind the wrong port. Let each fall back to its own default.
  const { PORT: _inheritedPort, ...baseEnv } = process.env;
  const env = {
    ...baseEnv,
    DATABASE_URL: `file:${path.join(tempDir, 'e2e.db')}`,
    UPLOAD_DIR: path.join(tempDir, 'uploads'),
    JWT_SECRET: 'e2e-secret',
    PUBLIC_API_URL: `http://localhost:${apiPort}`,
    FRONTEND_URL: `http://127.0.0.1:${webPort}`,
    CORS_ORIGIN: `http://localhost:${webPort},http://127.0.0.1:${webPort}`,
  };
  let child;
  let shuttingDown = false;

  async function cleanup(exitCode = 0) {
    if (shuttingDown) return;
    shuttingDown = true;

    if (child && child.exitCode === null) {
      child.kill('SIGTERM');
      await new Promise((resolve) => {
        child.once('close', resolve);
        setTimeout(resolve, 2_000).unref();
      });
      if (child.exitCode === null) {
        child.kill('SIGKILL');
      }
    }

    await rm(tempDir, { recursive: true, force: true });
    process.exit(exitCode);
  }

  process.once('SIGINT', () => {
    void cleanup(130);
  });
  process.once('SIGTERM', () => {
    void cleanup(0);
  });

  try {
    await run(
      'pnpm',
      [
        '--dir',
        'packages/db',
        'exec',
        'prisma',
        'db',
        'push',
        '--schema',
        'prisma/schema.prisma',
        '--skip-generate',
      ],
      { env },
    );
  } catch (error) {
    // Ensure the throwaway DB/upload dir is removed even if schema setup fails.
    console.error(error instanceof Error ? error.stack : error);
    await cleanup(1);
    return;
  }

  child = spawn('pnpm', ['start'], {
    cwd: rootDir,
    env,
    stdio: 'inherit',
  });

  child.on('error', (error) => {
    console.error(error);
    void cleanup(1);
  });
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    console.error(
      `pnpm start exited before Playwright finished (${signal ?? `exit ${code}`})`,
    );
    void cleanup(code ?? 1);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
