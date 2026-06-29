import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createTranslator,
  listCatalogKeys,
  validateCatalogShape,
} from '../dist/index.js';

test('createTranslator reads nested keys and interpolates values', () => {
  const t = createTranslator({
    home: {
      hero: {
        title: 'Welcome, {{name}}',
      },
    },
  });

  assert.equal(t('home.hero.title', { name: 'Mokshit' }), 'Welcome, Mokshit');
});

test('createTranslator falls back to the fallback catalog for missing keys', () => {
  const t = createTranslator(
    {
      nav: {
        home: 'Startseite',
      },
    },
    {
      nav: {
        home: 'Home',
        docs: 'Documentation',
      },
    },
  );

  assert.equal(t('nav.home'), 'Startseite');
  assert.equal(t('nav.docs'), 'Documentation');
  assert.equal(t('nav.missing'), 'nav.missing');
});

test('listCatalogKeys returns leaf translation keys in sorted order', () => {
  assert.deepEqual(
    listCatalogKeys({
      z: 'Last',
      a: {
        c: 'Third',
        b: 'Second',
      },
    }),
    ['a.b', 'a.c', 'z'],
  );
});

test('validateCatalogShape reports missing, extra, empty, and type mismatch issues', () => {
  const issues = validateCatalogShape(
    {
      nav: {
        home: 'Home',
        docs: 'Docs',
      },
      cta: 'Get started',
      footer: {
        legal: 'MIT',
      },
    },
    {
      nav: {
        home: '',
        extra: 'Extra',
      },
      cta: {
        label: 'Wrong shape',
      },
    },
  );

  assert.deepEqual(issues, [
    { path: 'cta', type: 'type-mismatch' },
    { path: 'footer', type: 'missing' },
    { path: 'nav.docs', type: 'missing' },
    { path: 'nav.extra', type: 'extra' },
    { path: 'nav.home', type: 'empty' },
  ]);
});
