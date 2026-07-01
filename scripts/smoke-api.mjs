import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const apiEntry = path.join(rootDir, 'apps/api/dist/main.js');
const timeoutMs = 20_000;

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

      const detail = [
        `${command} ${args.join(' ')} failed with ${signal ?? `exit ${code}`}`,
        stdout.trim() ? `stdout:\n${stdout.trim()}` : '',
        stderr.trim() ? `stderr:\n${stderr.trim()}` : '',
      ]
        .filter(Boolean)
        .join('\n\n');
      reject(new Error(detail));
    });
  });
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Could not allocate a port')));
        return;
      }

      server.close(() => resolve(address.port));
    });
  });
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForUploadUnauthorized(port, child, getLogs) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `API exited before becoming ready with code ${child.exitCode}.\n${getLogs()}`,
      );
    }

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/uploads`, {
        method: 'POST',
        signal: AbortSignal.timeout(1_000),
      });

      if (response.status === 401) {
        return;
      }

      lastError = new Error(
        `Expected POST /api/uploads to return 401, got ${response.status}`,
      );
    } catch (error) {
      lastError = error;
    }

    await delay(250);
  }

  throw new Error(
    `API did not pass smoke check within ${timeoutMs}ms: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }\n${getLogs()}`,
  );
}

async function main() {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'dailyhabbit-api-smoke-'));
  const databaseUrl = `file:${path.join(tempDir, 'smoke.db')}`;
  const uploadDir = path.join(tempDir, 'uploads');
  const port = await getFreePort();
  let apiProcess;

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
      {
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl,
        },
      },
    );

    let stdout = '';
    let stderr = '';
    apiProcess = spawn(process.execPath, [apiEntry], {
      cwd: rootDir,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        DATABASE_URL: databaseUrl,
        PORT: String(port),
        UPLOAD_DIR: uploadDir,
        JWT_SECRET: 'api-smoke-secret',
        CORS_ORIGIN: 'http://127.0.0.1:4321',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    apiProcess.stdout?.on('data', (chunk) => {
      stdout += chunk;
    });
    apiProcess.stderr?.on('data', (chunk) => {
      stderr += chunk;
    });
    apiProcess.on('error', (error) => {
      stderr += `\n${error.stack ?? error.message}`;
    });

    const getLogs = () =>
      [
        stdout.trim() ? `stdout:\n${stdout.trim()}` : '',
        stderr.trim() ? `stderr:\n${stderr.trim()}` : '',
      ]
        .filter(Boolean)
        .join('\n\n');

    await waitForUploadUnauthorized(port, apiProcess, getLogs);
    console.log(`API smoke check passed on http://127.0.0.1:${port}`);
  } finally {
    if (apiProcess && apiProcess.exitCode === null) {
      apiProcess.kill('SIGTERM');
      await new Promise((resolve) => {
        apiProcess.once('close', resolve);
        setTimeout(resolve, 2_000).unref();
      });
    }

    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
