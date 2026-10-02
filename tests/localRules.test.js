import test from 'node:test';
import assert from 'node:assert/strict';

import { LocalRulesDatabase } from '../server/localRules.js';

test('local rules database reads the manifest, catalogs, and selected details', () => {
  const database = new LocalRulesDatabase();
  const manifest = database.getManifest();
  const monsters = database.getCatalog('monsters');
  const willOWisp = database.getCatalogRecord('monsters', 'will-o-wisp');

  assert.equal(manifest.edition, '2024');
  assert.equal(monsters.items.length, manifest.catalogs.monsters.count);
  assert.equal(willOWisp.id, 'will-o-wisp');
  assert.equal(willOWisp.detailAvailable, true);
  assert.equal(willOWisp.hitPoints.average, 27);
});

test('local rules database rejects traversal paths and returns null for missing detail files', () => {
  const database = new LocalRulesDatabase();
  assert.throws(() => database.getRecord('../outside.json'), /rules database/);
  assert.throws(() => database.getRecord('%2e%2e/outside.json'), /rules database/);
  assert.equal(database.getRecord('monsters/not-present.json'), null);
});
