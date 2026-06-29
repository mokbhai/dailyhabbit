#!/usr/bin/env node

import { access, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createInterface } from 'node:readline/promises';
import { pathToFileURL } from 'node:url';

const WEB_APP_DIRECTORIES = ['apps/web', 'apps/secondary-web', 'apps/web-host'];

const OBSOLETE_TEST_FILE = 'tests/root-start-scripts.test.mjs';

const REMOVED_WORKSPACE_NAMES = [
  '@workspace-starter/web',
  '@workspace-starter/secondary-web',
  '@workspace-starter/web-host',
];

const KNOWN_START_SCRIPT =
  'pnpm build && node scripts/build-frontends.mjs && pnpm -r --parallel --filter @workspace-starter/web-host --filter @workspace-starter/api start';
const API_ONLY_START_SCRIPT =
  'pnpm build && pnpm --filter @workspace-starter/api start';
const KNOWN_BUILD_FRONTENDS_SCRIPT = 'node scripts/build-frontends.mjs';
const FRONTEND_BUILD_SCRIPT_FILE = 'scripts/build-frontends.mjs';

const KNOWN_DOCKER_COMPOSE = `services:
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

const DOCKER_COMPOSE_CHANGES = [
  {
    relativePath: 'docker-compose.yml',
    before: KNOWN_DOCKER_COMPOSE,
    after: API_ONLY_DOCKER_COMPOSE,
    action: 'replace',
    staleTerms: ['apps/web-host/Dockerfile'],
  },
];

function hasRemovedWorkspaceReference(command) {
  return REMOVED_WORKSPACE_NAMES.some((workspaceName) =>
    command.includes(workspaceName),
  );
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function removeObsoleteTestArgument(command) {
  if (!command.includes(OBSOLETE_TEST_FILE)) {
    return command;
  }

  return command
    .replace(new RegExp(`\\s+${escapeRegExp(OBSOLETE_TEST_FILE)}`, 'g'), '')
    .replace(new RegExp(`${escapeRegExp(OBSOLETE_TEST_FILE)}\\s+`, 'g'), '')
    .replace(OBSOLETE_TEST_FILE, '');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function updateRootPackageForRemovedWebApps(rootPackage) {
  const updatedPackage = cloneJson(rootPackage);
  const scripts = updatedPackage.scripts ?? {};
  const scriptChanges = [];

  for (const [scriptName, command] of Object.entries(scripts)) {
    if (scriptName === 'test' && typeof command === 'string') {
      const updatedTestCommand = removeObsoleteTestArgument(command);
      if (updatedTestCommand !== command) {
        scripts.test = updatedTestCommand;
        scriptChanges.push({
          scriptName,
          action: 'replace',
          before: command,
          after: updatedTestCommand,
        });
      }
      continue;
    }

    if (
      scriptName === 'build:frontends' &&
      command === KNOWN_BUILD_FRONTENDS_SCRIPT
    ) {
      delete scripts['build:frontends'];
      scriptChanges.push({ scriptName, action: 'delete', before: command });
      continue;
    }

    if (typeof command !== 'string' || !hasRemovedWorkspaceReference(command)) {
      continue;
    }

    if (scriptName === 'start' && command === KNOWN_START_SCRIPT) {
      scripts.start = API_ONLY_START_SCRIPT;
      scriptChanges.push({
        scriptName,
        action: 'replace',
        before: command,
        after: API_ONLY_START_SCRIPT,
      });
      continue;
    }

    throw new Error(
      [
        'Refusing to remove web apps because package.json has a custom script',
        `that still references ${REMOVED_WORKSPACE_NAMES.join(', ')}.`,
        `Review scripts.${scriptName} before running this command.`,
      ].join(' '),
    );
  }

  updatedPackage.scripts = scripts;

  return { updatedPackage, scriptChanges };
}

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function readTextIfPresent(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function planDockerComposeChanges(repoDir) {
  const fileChanges = [];

  for (const change of DOCKER_COMPOSE_CHANGES) {
    const filePath = path.join(repoDir, change.relativePath);
    const currentContent = await readTextIfPresent(filePath);

    if (currentContent === null) {
      continue;
    }

    if (currentContent === change.before) {
      fileChanges.push(change);
      continue;
    }

    if (change.staleTerms.some((term) => currentContent.includes(term))) {
      throw new Error(
        [
          'Refusing to remove web apps because',
          `${change.relativePath} has custom web app references.`,
          'Review that file before running this command.',
        ].join(' '),
      );
    }
  }

  return fileChanges;
}

async function applyFileChanges(repoDir, fileChanges) {
  for (const change of fileChanges) {
    const filePath = path.join(repoDir, change.relativePath);

    if (change.action === 'delete') {
      await rm(filePath, { force: true });
      continue;
    }

    await writeFile(filePath, change.after);
  }
}

export async function removeTemplateWebApps({ repoDir, dryRun = false }) {
  const rootPackagePath = path.join(repoDir, 'package.json');
  const rootPackage = await readJson(rootPackagePath);
  const { updatedPackage, scriptChanges } =
    updateRootPackageForRemovedWebApps(rootPackage);
  const fileChanges = await planDockerComposeChanges(repoDir);

  const obsoleteTestPath = path.join(repoDir, OBSOLETE_TEST_FILE);
  if (await pathExists(obsoleteTestPath)) {
    fileChanges.push({
      relativePath: OBSOLETE_TEST_FILE,
      action: 'delete',
    });
  }

  // The frontend build/stage helper only serves the bundled frontends, so it
  // is removed alongside them.
  const frontendBuildScriptPath = path.join(
    repoDir,
    FRONTEND_BUILD_SCRIPT_FILE,
  );
  if (await pathExists(frontendBuildScriptPath)) {
    fileChanges.push({
      relativePath: FRONTEND_BUILD_SCRIPT_FILE,
      action: 'delete',
    });
  }

  const existingDirectories = [];
  for (const relativePath of WEB_APP_DIRECTORIES) {
    if (await pathExists(path.join(repoDir, relativePath))) {
      existingDirectories.push(relativePath);
    }
  }

  if (!dryRun) {
    await applyFileChanges(repoDir, fileChanges);
    await writeJson(rootPackagePath, updatedPackage);

    for (const relativePath of existingDirectories) {
      await rm(path.join(repoDir, relativePath), {
        recursive: true,
        force: true,
      });
    }
  }

  return {
    dryRun,
    removedDirectories: existingDirectories,
    scriptChanges,
    fileChanges: fileChanges.map(({ relativePath, action }) => ({
      relativePath,
      action,
    })),
  };
}

function parseArgs(argv) {
  const options = {
    dryRun: false,
    yes: false,
    repoDir: process.cwd(),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (argument === '--yes') {
      options.yes = true;
      continue;
    }

    if (argument === '--repo-dir') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('--repo-dir requires a path.');
      }
      options.repoDir = path.resolve(value);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
}

async function confirmRemoval() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      'Pass --yes to remove web apps in a non-interactive shell.',
    );
  }

  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await prompt.question(
      'Remove bundled web apps from this project? [y/N] ',
    );
    return answer.trim().toLowerCase() === 'y';
  } finally {
    prompt.close();
  }
}

function printResult(result) {
  const prefix = result.dryRun ? 'Would remove' : 'Removed';

  if (result.removedDirectories.length === 0) {
    console.log('No bundled web app directories were present.');
  } else {
    console.log(`${prefix}:`);
    for (const relativePath of result.removedDirectories) {
      console.log(`- ${relativePath}`);
    }
  }

  if (result.scriptChanges.length > 0) {
    console.log(
      result.dryRun
        ? 'Would update package.json scripts:'
        : 'Updated package.json scripts:',
    );
    for (const change of result.scriptChanges) {
      console.log(`- ${change.scriptName}: ${change.action}`);
    }
  }

  if (result.fileChanges.length > 0) {
    console.log(
      result.dryRun
        ? 'Would update supporting files:'
        : 'Updated supporting files:',
    );
    for (const change of result.fileChanges) {
      console.log(`- ${change.relativePath}: ${change.action}`);
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.dryRun && !options.yes && !(await confirmRemoval())) {
    console.log('Web app removal cancelled.');
    return;
  }

  const result = await removeTemplateWebApps({
    repoDir: options.repoDir,
    dryRun: options.dryRun,
  });

  printResult(result);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
