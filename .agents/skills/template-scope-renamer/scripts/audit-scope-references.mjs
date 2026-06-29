#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const skipDirectories = new Set([
  '.astro',
  '.git',
  '.turbo',
  'coverage',
  'dist',
  'node_modules',
]);

const skipExtensions = new Set([
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.pdf',
  '.png',
  '.webp',
  '.woff',
  '.woff2',
]);

function usage() {
  console.error(
    'Usage: node audit-scope-references.mjs <old-scope> [repo-root] [--include-unscoped]',
  );
}

const includeUnscoped = process.argv.includes('--include-unscoped');
const positional = process.argv
  .slice(2)
  .filter((argument) => argument !== '--include-unscoped');

const oldScope = positional[0];
const root = resolve(positional[1] ?? process.cwd());

if (!oldScope) {
  usage();
  process.exit(2);
}

if (!/^@[a-z0-9][a-z0-9._-]*$/.test(oldScope)) {
  console.error(`Invalid npm scope: ${oldScope}`);
  usage();
  process.exit(2);
}

const unscoped = oldScope.slice(1);
const terms = includeUnscoped ? [oldScope, unscoped] : [oldScope];
const matches = [];

function isBinary(buffer) {
  return buffer.includes(0);
}

function shouldSkipFile(filePath) {
  return skipExtensions.has(extname(filePath).toLowerCase());
}

function findTermIndexes(line, term) {
  const indexes = [];
  let startIndex = 0;

  while (startIndex < line.length) {
    const index = line.indexOf(term, startIndex);
    if (index === -1) {
      break;
    }

    if (term !== unscoped || line[index - 1] !== '@') {
      indexes.push(index);
    }

    startIndex = index + term.length;
  }

  return indexes;
}

function scanFile(filePath) {
  if (shouldSkipFile(filePath)) {
    return;
  }

  const buffer = readFileSync(filePath);
  if (isBinary(buffer)) {
    return;
  }

  const text = buffer.toString('utf8');
  const lines = text.split(/\r?\n/);

  lines.forEach((line, lineIndex) => {
    terms.forEach((term) => {
      findTermIndexes(line, term).forEach((columnIndex) => {
        matches.push({
          column: columnIndex + 1,
          line: lineIndex + 1,
          path: relative(root, filePath),
          text: line.trimEnd(),
        });
      });
    });
  });
}

function walk(directory) {
  readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    if (entry.isDirectory() && skipDirectories.has(entry.name)) {
      return;
    }

    const entryPath = join(directory, entry.name);
    const stats = statSync(entryPath);

    if (stats.isDirectory()) {
      walk(entryPath);
      return;
    }

    if (stats.isFile()) {
      scanFile(entryPath);
    }
  });
}

walk(root);

if (matches.length === 0) {
  console.log(`No references found for ${oldScope}.`);
  process.exit(0);
}

matches.forEach((match) => {
  console.log(`${match.path}:${match.line}:${match.column}: ${match.text}`);
});

const fileCount = new Set(matches.map((match) => match.path)).size;
console.error(
  `Found ${matches.length} reference(s) to ${oldScope} across ${fileCount} file(s).`,
);
process.exit(1);
