import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const rootDir = new URL('../', import.meta.url);

async function readPackageJson(relativePath) {
  const file = new URL(relativePath, rootDir);
  return JSON.parse(await readFile(file, 'utf8'));
}

test('workspace exposes production start scripts for root, web-host, and api', async () => {
  const [rootPkg, webHostPkg, apiPkg] = await Promise.all([
    readPackageJson('package.json'),
    readPackageJson('apps/web-host/package.json'),
    readPackageJson('apps/api/package.json'),
  ]);

  assert.equal(
    typeof rootPkg.scripts?.start,
    'string',
    'root package.json should define a start script',
  );
  assert.match(
    rootPkg.scripts.start,
    /pnpm build/,
    'root start script should build before launching production services',
  );
  assert.match(
    rootPkg.scripts.start,
    /scripts\/build-frontends\.mjs/,
    'root start script should stage frontends for web-host',
  );
  assert.match(
    rootPkg.scripts.start,
    /@workspace-starter\/web-host/,
    'root start script should launch the web-host workspace',
  );
  assert.match(
    rootPkg.scripts.start,
    /@workspace-starter\/api/,
    'root start script should launch the api workspace',
  );

  assert.equal(
    webHostPkg.scripts?.start,
    'node dist/server.js',
    'web-host package.json should define a production start script',
  );
  assert.equal(
    apiPkg.scripts?.start,
    'node dist/main',
    'api package.json should keep the production start script',
  );
});
