#!/usr/bin/env node

// Deploy dispatcher (template-owned, host-agnostic).
//
// The build-and-publish workflow builds and pushes one image per deployable
// app, then invokes this script. This script does NOT know how to deploy to
// any particular host. It reads DEPLOY_TARGET and hands a fixed contract to a
// product-provided adapter at scripts/deploy/adapters/<target>.mjs:
//
//   export default async function deploy(context) { ... }
//
// where context = {
//   target,                       // the DEPLOY_TARGET value
//   images:   { web-host: 'ghcr.io/owner/web-host:<sha>', api: '…' },
//   apps:     ['web-host', 'api'],
//   sha:      '<git sha>',
//   registry: 'ghcr.io/owner',
//   env:      process.env,
// }
//
// With no DEPLOY_TARGET, or no matching adapter, deploy is a documented no-op
// so a fresh clone stays green. A product specializes deployment by adding an
// adapter file and setting DEPLOY_TARGET — no change to this dispatcher.

import { access } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const DEFAULT_ADAPTERS_DIR = path.join(scriptDir, 'adapters');

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function parseImages(rawImages) {
  if (!rawImages) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawImages);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // fall through to the explicit error below
  }

  throw new Error('DEPLOY_IMAGES must be a JSON object of { app: imageRef }.');
}

export function parseDeployContext(env = process.env) {
  const images = parseImages(env.DEPLOY_IMAGES);
  const apps = env.DEPLOY_APPS
    ? env.DEPLOY_APPS.split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    : Object.keys(images);

  return {
    target: env.DEPLOY_TARGET?.trim() || null,
    images,
    apps,
    sha: env.DEPLOY_SHA?.trim() || null,
    registry: env.DEPLOY_REGISTRY?.trim() || null,
    env,
  };
}

export function adapterPathFor(target, adaptersDir = DEFAULT_ADAPTERS_DIR) {
  return path.join(adaptersDir, `${target}.mjs`);
}

export async function runDeploy({
  env = process.env,
  adaptersDir = DEFAULT_ADAPTERS_DIR,
  log = console.log,
} = {}) {
  const context = parseDeployContext(env);

  if (!context.target) {
    log(
      'No DEPLOY_TARGET configured; skipping deploy. ' +
        'Set DEPLOY_TARGET and add scripts/deploy/adapters/<target>.mjs to deploy.',
    );
    return { status: 'skipped', context };
  }

  const adapterPath = adapterPathFor(context.target, adaptersDir);
  if (!(await pathExists(adapterPath))) {
    log(
      `No deploy adapter found for DEPLOY_TARGET="${context.target}" ` +
        `(expected ${adapterPath}). Skipping deploy.`,
    );
    return { status: 'no-adapter', context };
  }

  const adapterModule = await import(pathToFileURL(adapterPath).href);
  const deploy = adapterModule.default;
  if (typeof deploy !== 'function') {
    throw new Error(
      `Adapter ${adapterPath} must export a default async function.`,
    );
  }

  log(
    `Deploying via "${context.target}" adapter (${context.apps.join(', ')}).`,
  );
  await deploy(context);
  return { status: 'deployed', context };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  runDeploy().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
