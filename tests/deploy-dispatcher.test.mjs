import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

async function loadDispatcher() {
  const moduleUrl = pathToFileURL(
    path.join(process.cwd(), 'scripts/deploy/run.mjs'),
  );
  return import(moduleUrl.href);
}

function silentLog() {
  const lines = [];
  const log = (message) => lines.push(message);
  return { lines, log };
}

test('parseDeployContext reads the image map and derives apps', async () => {
  const { parseDeployContext } = await loadDispatcher();

  const context = parseDeployContext({
    DEPLOY_TARGET: 'cloud-run',
    DEPLOY_IMAGES: JSON.stringify({
      'web-host': 'ghcr.io/acme/app/web-host:abc123',
      api: 'ghcr.io/acme/app/api:abc123',
    }),
    DEPLOY_SHA: 'abc123',
    DEPLOY_REGISTRY: 'ghcr.io/acme/app',
  });

  assert.equal(context.target, 'cloud-run');
  assert.equal(context.sha, 'abc123');
  assert.equal(context.registry, 'ghcr.io/acme/app');
  assert.deepEqual(context.apps.sort(), ['api', 'web-host']);
  assert.equal(context.images.api, 'ghcr.io/acme/app/api:abc123');
});

test('parseDeployContext rejects malformed DEPLOY_IMAGES', async () => {
  const { parseDeployContext } = await loadDispatcher();
  assert.throws(
    () => parseDeployContext({ DEPLOY_IMAGES: 'not-json' }),
    /DEPLOY_IMAGES must be a JSON object/,
  );
});

test('runDeploy skips when no DEPLOY_TARGET is set', async () => {
  const { runDeploy } = await loadDispatcher();
  const { lines, log } = silentLog();

  const result = await runDeploy({ env: {}, log });

  assert.equal(result.status, 'skipped');
  assert.match(lines.join('\n'), /No DEPLOY_TARGET configured/);
});

test('runDeploy reports a missing adapter without failing', async () => {
  const { runDeploy } = await loadDispatcher();
  const adaptersDir = await mkdtemp(path.join(tmpdir(), 'deploy-adapters-'));
  const { lines, log } = silentLog();

  try {
    const result = await runDeploy({
      env: { DEPLOY_TARGET: 'missing-target' },
      adaptersDir,
      log,
    });

    assert.equal(result.status, 'no-adapter');
    assert.match(lines.join('\n'), /No deploy adapter found/);
  } finally {
    await rm(adaptersDir, { recursive: true, force: true });
  }
});

test('runDeploy invokes a matching adapter with the deploy context', async () => {
  const { runDeploy } = await loadDispatcher();
  const adaptersDir = await mkdtemp(path.join(tmpdir(), 'deploy-adapters-'));
  const markerFile = path.join(adaptersDir, 'invoked.json');

  await writeFile(
    path.join(adaptersDir, 'fixture-target.mjs'),
    `import { writeFile } from 'node:fs/promises';
export default async function deploy(context) {
  await writeFile(context.env.MARKER_FILE, JSON.stringify(context.images));
}
`,
  );

  try {
    const result = await runDeploy({
      env: {
        DEPLOY_TARGET: 'fixture-target',
        DEPLOY_IMAGES: JSON.stringify({ api: 'ghcr.io/acme/app/api:sha' }),
        MARKER_FILE: markerFile,
      },
      adaptersDir,
      log: () => {},
    });

    assert.equal(result.status, 'deployed');
    const recorded = JSON.parse(await readFile(markerFile, 'utf8'));
    assert.equal(recorded.api, 'ghcr.io/acme/app/api:sha');
  } finally {
    await rm(adaptersDir, { recursive: true, force: true });
  }
});
