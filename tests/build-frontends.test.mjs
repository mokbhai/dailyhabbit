import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

async function loadBuildFrontends() {
  const moduleUrl = pathToFileURL(
    path.join(process.cwd(), 'scripts/build-frontends.mjs'),
  );
  return import(moduleUrl.href);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

// Builds an apps/ tree: each entry is [name, isAstro].
async function createFixture(apps) {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'build-frontends-'));
  for (const [name, isAstro] of apps) {
    const appDir = path.join(tempDir, 'apps', name);
    await mkdir(appDir, { recursive: true });
    await writeJson(path.join(appDir, 'package.json'), {
      name: `@workspace-starter/${name}`,
    });
    if (isAstro) {
      await writeFile(
        path.join(appDir, 'astro.config.ts'),
        'export default {};\n',
      );
    }
  }
  return tempDir;
}

test('discoverFrontends finds Astro apps and mounts the primary at root', async () => {
  const tempDir = await createFixture([
    ['web', true],
    ['secondary-web', true],
    ['api', false],
    ['web-host', false],
  ]);

  try {
    const { discoverFrontends } = await loadBuildFrontends();
    const frontends = await discoverFrontends({ repoDir: tempDir });

    assert.deepEqual(
      frontends.map((frontend) => frontend.name),
      ['secondary-web', 'web'],
      'only Astro apps are frontends, sorted by name',
    );

    const byName = Object.fromEntries(
      frontends.map((frontend) => [frontend.name, frontend]),
    );
    assert.equal(byName.web.mountPath, '/');
    assert.equal(byName.web.base, '/');
    assert.equal(byName['secondary-web'].mountPath, '/secondary-web');
    assert.equal(byName['secondary-web'].base, '/secondary-web');
    assert.equal(byName.web.packageName, '@workspace-starter/web');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('discoverFrontends honors an explicit primary', async () => {
  const tempDir = await createFixture([
    ['web', true],
    ['secondary-web', true],
  ]);

  try {
    const { discoverFrontends } = await loadBuildFrontends();
    const frontends = await discoverFrontends({
      repoDir: tempDir,
      primary: 'secondary-web',
    });

    const byName = Object.fromEntries(
      frontends.map((frontend) => [frontend.name, frontend]),
    );
    assert.equal(byName['secondary-web'].mountPath, '/');
    assert.equal(byName.web.mountPath, '/web');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('discoverFrontends rejects an unknown primary', async () => {
  const tempDir = await createFixture([['web', true]]);

  try {
    const { discoverFrontends } = await loadBuildFrontends();
    await assert.rejects(
      () => discoverFrontends({ repoDir: tempDir, primary: 'nope' }),
      /PRIMARY_FRONTEND "nope"/,
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('discoverFrontends throws when there are no Astro apps', async () => {
  const tempDir = await createFixture([
    ['api', false],
    ['web-host', false],
  ]);

  try {
    const { discoverFrontends } = await loadBuildFrontends();
    await assert.rejects(
      () => discoverFrontends({ repoDir: tempDir }),
      /No Astro frontends/,
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
