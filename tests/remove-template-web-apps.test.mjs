import test from 'node:test';
import assert from 'node:assert/strict';
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const KNOWN_START_SCRIPT =
  'pnpm build && node scripts/build-frontends.mjs && pnpm -r --parallel --filter @workspace-starter/web-host --filter @workspace-starter/api start';

const WEB_HOST_DOCKER_COMPOSE = `services:
  web-host:
    build:
      context: .
      dockerfile: apps/web-host/Dockerfile
      args:
        PUBLIC_API_URL: \${PUBLIC_API_URL:-http://localhost:3001}
    environment:
      NODE_ENV: production
      PORT: 4321
      HOST: 0.0.0.0
      PRIMARY_FRONTEND: \${PRIMARY_FRONTEND:-web}
    ports:
      - '\${WEB_PORT:-4321}:4321'
    depends_on:
      api:
        condition: service_started

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    environment:
      NODE_ENV: production
      PORT: 3001
      CORS_ORIGIN: \${CORS_ORIGIN:-http://localhost:4321,http://127.0.0.1:4321}
    ports:
      - '\${API_PORT:-3001}:3001'
`;

const API_ONLY_DOCKER_COMPOSE = `services:
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    environment:
      NODE_ENV: production
      PORT: 3001
      CORS_ORIGIN: \${CORS_ORIGIN:-http://localhost:4321,http://127.0.0.1:4321}
    ports:
      - '\${API_PORT:-3001}:3001'
`;

async function loadWebAppRemovalHelpers() {
  const moduleUrl = pathToFileURL(
    path.join(process.cwd(), 'scripts/template/remove-web-apps.mjs'),
  );
  return import(moduleUrl.href);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function createFixture() {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'starter-web-removal-'));

  await writeJson(path.join(tempDir, 'package.json'), {
    name: 'my-project',
    private: true,
    scripts: {
      dev: 'turbo dev',
      start: KNOWN_START_SCRIPT,
      'build:frontends': 'node scripts/build-frontends.mjs',
      'deploy:run': 'node scripts/deploy/run.mjs',
      test: 'node --test tests/root-start-scripts.test.mjs tests/setup-starter.test.mjs tests/remove-template-web-apps.test.mjs tests/repository-guardrails.test.mjs && turbo test',
      'template:remove-web-apps': 'node scripts/template/remove-web-apps.mjs',
    },
  });

  await mkdir(path.join(tempDir, 'tests'), { recursive: true });
  await writeFile(
    path.join(tempDir, 'tests', 'root-start-scripts.test.mjs'),
    "import test from 'node:test';\n",
  );

  await mkdir(path.join(tempDir, 'scripts'), { recursive: true });
  await writeFile(
    path.join(tempDir, 'scripts', 'build-frontends.mjs'),
    'export {};\n',
  );

  for (const appName of ['api', 'web', 'secondary-web', 'web-host']) {
    await mkdir(path.join(tempDir, 'apps', appName), { recursive: true });
    await writeJson(path.join(tempDir, 'apps', appName, 'package.json'), {
      name: `@workspace-starter/${appName}`,
    });
  }

  await writeFile(
    path.join(tempDir, 'docker-compose.yml'),
    WEB_HOST_DOCKER_COMPOSE,
  );

  return tempDir;
}

test('removeTemplateWebApps removes bundled web apps and rewrites root scripts', async () => {
  const tempDir = await createFixture();

  try {
    const { removeTemplateWebApps } = await loadWebAppRemovalHelpers();

    const result = await removeTemplateWebApps({ repoDir: tempDir });

    assert.deepEqual(result.removedDirectories, [
      'apps/web',
      'apps/secondary-web',
      'apps/web-host',
    ]);
    await access(path.join(tempDir, 'apps', 'api', 'package.json'));
    await assert.rejects(access(path.join(tempDir, 'apps', 'web')));
    await assert.rejects(access(path.join(tempDir, 'apps', 'secondary-web')));
    await assert.rejects(access(path.join(tempDir, 'apps', 'web-host')));

    const rootPackage = JSON.parse(
      await readFile(path.join(tempDir, 'package.json'), 'utf8'),
    );
    assert.equal(
      rootPackage.scripts.start,
      'pnpm build && pnpm --filter @workspace-starter/api start',
    );
    assert.equal(rootPackage.scripts['build:frontends'], undefined);
    assert.equal(
      rootPackage.scripts['deploy:run'],
      'node scripts/deploy/run.mjs',
    );
    assert.equal(rootPackage.scripts.dev, 'turbo dev');
    assert.equal(
      rootPackage.scripts['template:remove-web-apps'],
      'node scripts/template/remove-web-apps.mjs',
    );

    await assert.rejects(
      access(path.join(tempDir, 'scripts', 'build-frontends.mjs')),
    );
    await assert.rejects(
      access(path.join(tempDir, 'tests', 'root-start-scripts.test.mjs')),
    );
    assert.doesNotMatch(
      rootPackage.scripts.test,
      /tests\/root-start-scripts\.test\.mjs/,
    );
    assert.match(rootPackage.scripts.test, /tests\/setup-starter\.test\.mjs/);
    assert.match(
      rootPackage.scripts.test,
      /tests\/remove-template-web-apps\.test\.mjs/,
    );
    assert.match(
      rootPackage.scripts.test,
      /tests\/repository-guardrails\.test\.mjs/,
    );
    assert.match(rootPackage.scripts.test, /turbo test/);

    assert.equal(
      await readFile(path.join(tempDir, 'docker-compose.yml'), 'utf8'),
      API_ONLY_DOCKER_COMPOSE,
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('removeTemplateWebApps dry run leaves files unchanged', async () => {
  const tempDir = await createFixture();

  try {
    const { removeTemplateWebApps } = await loadWebAppRemovalHelpers();

    const result = await removeTemplateWebApps({
      repoDir: tempDir,
      dryRun: true,
    });

    assert.equal(result.dryRun, true);
    assert.deepEqual(result.removedDirectories, [
      'apps/web',
      'apps/secondary-web',
      'apps/web-host',
    ]);
    await access(path.join(tempDir, 'apps', 'web', 'package.json'));

    const rootPackage = JSON.parse(
      await readFile(path.join(tempDir, 'package.json'), 'utf8'),
    );
    assert.match(rootPackage.scripts.start, /@workspace-starter\/web-host/);
    assert.equal(
      rootPackage.scripts['build:frontends'],
      'node scripts/build-frontends.mjs',
    );
    assert.match(
      rootPackage.scripts.test,
      /tests\/root-start-scripts\.test\.mjs/,
    );
    await access(path.join(tempDir, 'scripts', 'build-frontends.mjs'));
    await access(path.join(tempDir, 'tests', 'root-start-scripts.test.mjs'));
    assert.match(
      await readFile(path.join(tempDir, 'docker-compose.yml'), 'utf8'),
      /apps\/web-host\/Dockerfile/,
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('removeTemplateWebApps refuses custom root scripts that reference removed web apps', async () => {
  const tempDir = await createFixture();

  try {
    const rootPackagePath = path.join(tempDir, 'package.json');
    const rootPackage = JSON.parse(await readFile(rootPackagePath, 'utf8'));
    rootPackage.scripts.start =
      'pnpm build && pnpm --filter @workspace-starter/web start';
    await writeJson(rootPackagePath, rootPackage);

    const { removeTemplateWebApps } = await loadWebAppRemovalHelpers();

    await assert.rejects(
      () => removeTemplateWebApps({ repoDir: tempDir }),
      /Refusing to remove web apps/,
    );
    await access(path.join(tempDir, 'apps', 'web', 'package.json'));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('removeTemplateWebApps refuses custom Docker compose files that reference removed web apps', async () => {
  const tempDir = await createFixture();

  try {
    await writeFile(
      path.join(tempDir, 'docker-compose.yml'),
      `services:
  custom-host:
    build:
      context: .
      dockerfile: apps/web-host/Dockerfile
`,
    );

    const { removeTemplateWebApps } = await loadWebAppRemovalHelpers();

    await assert.rejects(
      () => removeTemplateWebApps({ repoDir: tempDir }),
      /Refusing to remove web apps/,
    );
    await access(path.join(tempDir, 'apps', 'web', 'package.json'));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
