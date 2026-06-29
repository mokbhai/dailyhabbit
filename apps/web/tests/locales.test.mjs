import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { validateCatalogShape } from '@workspace-starter/i18n';

const localesDir = path.join(process.cwd(), 'src', 'locales');
const defaultLocale = 'en';
const supportedLocales = ['en', 'de'];
const namespaces = ['home'];

async function readCatalog(locale, namespace) {
  const catalogPath = path.join(localesDir, locale, `${namespace}.json`);
  return JSON.parse(await readFile(catalogPath, 'utf8'));
}

test('every configured web locale has the expected namespace files', async () => {
  const localeFolders = await readdir(localesDir);

  assert.deepEqual(localeFolders.sort(), [...supportedLocales].sort());

  for (const locale of supportedLocales) {
    const files = await readdir(path.join(localesDir, locale));
    assert.deepEqual(
      files.sort(),
      namespaces.map((namespace) => `${namespace}.json`),
    );
  }
});

test('translated web catalogs match the default locale shape', async () => {
  for (const namespace of namespaces) {
    const reference = await readCatalog(defaultLocale, namespace);

    for (const locale of supportedLocales.filter(
      (item) => item !== defaultLocale,
    )) {
      const candidate = await readCatalog(locale, namespace);
      assert.deepEqual(validateCatalogShape(reference, candidate), []);
    }
  }
});
