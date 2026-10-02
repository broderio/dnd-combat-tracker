import test from 'node:test';
import assert from 'node:assert/strict';

import { RulesRepository } from '../public/js/rulesRepository.js';

function response(body, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

test('rules repository lazily loads and caches the manifest, catalog, and detail records', async () => {
  const records = {
    '/rules/index.json': {
      schemaVersion: 4,
      edition: '2024',
      classes: [{ id: 'fighter', path: 'classes/fighter/class.json', subclasses: [{ id: 'champion', path: 'classes/fighter/champion.json' }] }],
      catalogs: { species: { path: 'species/index.json' } },
    },
    '/rules/species/index.json': { items: [{ id: 'human', name: 'Human', path: 'species/human.json' }] },
    '/rules/species/human.json': { id: 'human', name: 'Human', sources: [{ publication: 'Player Handbook' }] },
    '/rules/classes/fighter/class.json': { id: 'fighter', name: 'Fighter' },
    '/rules/classes/fighter/champion.json': { id: 'champion', name: 'Champion' },
  };
  const fetched = [];
  const repository = new RulesRepository({
    baseUrl: 'http://localhost/rules/',
    fetchImpl: async (url) => {
      const pathname = new URL(url).pathname;
      fetched.push(pathname);
      return records[pathname] ? response(records[pathname]) : response({}, false, 404);
    },
  });

  const [human, catalog, classRecord, subclass] = await Promise.all([
    repository.getCatalogRecord('species', 'human'),
    repository.getCatalog('species'),
    repository.getClass('fighter'),
    repository.getSubclass('fighter', 'champion'),
  ]);
  assert.equal(human.name, 'Human');
  assert.equal(catalog.items.length, 1);
  assert.equal(classRecord.name, 'Fighter');
  assert.equal(subclass.name, 'Champion');
  assert.equal(fetched.filter((path) => path === '/rules/index.json').length, 1);
  assert.equal(fetched.filter((path) => path === '/rules/species/human.json').length, 1);
  assert.equal(await repository.getCatalogRecord('species', 'missing'), null);
});

test('rules repository filters catalog summaries without loading detail records', async () => {
  const repository = new RulesRepository({
    baseUrl: 'http://localhost/rules/',
    fetchImpl: async (url) => {
      const pathname = new URL(url).pathname;
      if (pathname === '/rules/index.json') return response({ schemaVersion: 4, classes: [], catalogs: { feats: { path: 'feats/index.json' } } });
      if (pathname === '/rules/feats/index.json') {
        return response({ items: [
          { id: 'alert', name: 'Alert', path: 'feats/alert.json' },
          { id: 'actor', name: 'Actor', path: 'feats/actor.json' },
        ] });
      }
      throw new Error(`Unexpected detail fetch: ${pathname}`);
    },
  });

  assert.deepEqual(await repository.searchCatalog('feats', 'act'), [
    { id: 'actor', name: 'Actor', path: 'feats/actor.json' },
  ]);
});

test('rules repository refuses absolute and traversal paths', async () => {
  let fetchCount = 0;
  const repository = new RulesRepository({
    baseUrl: 'http://localhost/rules/',
    fetchImpl: async () => { fetchCount += 1; return response({}); },
  });

  await assert.rejects(repository.getRecord('../secret.json'), /rules database/);
  await assert.rejects(repository.getRecord('/secret.json'), /rules database/);
  await assert.rejects(repository.getRecord('%2e%2e/secret.json'), /rules database/);
  assert.equal(fetchCount, 0);
});

test('rules repository can read species and background records from the generated local database', async () => {
  const rulesRoot = new URL('../5e_rules/rules/', import.meta.url);
  const repository = new RulesRepository({
    baseUrl: 'http://local.test/rules/',
    fetchImpl: async (url) => {
      const relativePath = new URL(url).pathname.replace('/rules/', '');
      const fileUrl = new URL(relativePath, rulesRoot);
      try {
        const data = await import('node:fs/promises').then(({ readFile }) => readFile(fileUrl, 'utf8'));
        return response(JSON.parse(data));
      } catch {
        return response({}, false, 404);
      }
    },
  });

  const [species, backgrounds, human, acolyte] = await Promise.all([
    repository.getCatalog('species'),
    repository.getCatalog('backgrounds'),
    repository.getCatalogRecord('species', 'human'),
    repository.getCatalogRecord('backgrounds', 'acolyte'),
  ]);
  assert.ok(species.items.length > 0);
  assert.ok(backgrounds.items.length > 0);
  assert.equal(human.id, 'human');
  assert.equal(acolyte.id, 'acolyte');
  assert.ok(Array.isArray(human.sources));
  assert.ok(Array.isArray(acolyte.sources));
});
