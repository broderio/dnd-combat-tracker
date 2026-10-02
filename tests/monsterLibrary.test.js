import test from 'node:test';
import assert from 'node:assert/strict';

import { monsterLibrary } from '../server/monsterLibrary.js';

test('search with no filters returns results capped at the default limit', () => {
  const results = monsterLibrary.search({});
  assert.ok(results.length > 0);
  assert.ok(results.length <= 50);
});

test('search by name only returns monsters whose name includes the needle (case-insensitive)', () => {
  const results = monsterLibrary.search({ name: 'goblin' });
  assert.ok(results.length > 0);
  for (const m of results) {
    assert.ok(m.name.toLowerCase().includes('goblin'));
  }
});

test('search respects an explicit limit', () => {
  const results = monsterLibrary.search({ limit: 3 });
  assert.ok(results.length <= 3);
});

test('search by crMin/crMax filters out monsters outside the CR range', () => {
  const results = monsterLibrary.search({ crMin: 5, crMax: 5, limit: 200 });
  for (const m of results) {
    assert.equal(m.cr, 5);
  }
});

test('getTemplate returns the full template for a known id and null for an unknown id', () => {
  const [sample] = monsterLibrary.search({ limit: 1 });
  assert.ok(sample);
  const template = monsterLibrary.getTemplate(sample.id);
  assert.equal(template.id, sample.id);
  assert.equal(monsterLibrary.getTemplate('not-a-real-id'), null);
});

test('local monster templates use stable IDs and map normalized ability mechanics', () => {
  const result = monsterLibrary.search({ name: "will-o'-wisp", limit: 1 })[0];
  assert.ok(result);
  assert.equal(result.id, 'will-o-wisp');

  const template = monsterLibrary.getTemplate(result.id);
  assert.equal(template.id, 'will-o-wisp');
  assert.equal(template.ac, 19);
  assert.equal(template.hpMax, 27);
  assert.equal(template.source, 'Monster Manual 2024 (BR)');
  assert.equal(template.attacks[0].name, 'Shock');
  assert.equal(template.attacks[0].toHit, '+4');
  assert.match(template.attacks[0].damage, /2d8 \+ 2/);
});

test('monster search filters local normalized creature type', () => {
  const results = monsterLibrary.search({ type: 'undead', limit: 20 });
  assert.ok(results.length > 0);
  assert.ok(results.every((monster) => monster.type.toLowerCase().includes('undead')));
});

test('every available local monster detail resolves without fabricating missing fields', () => {
  const entries = monsterLibrary.database.getCatalog('monsters').items.filter((entry) => entry.detailAvailable !== false);
  assert.equal(entries.length, 498);
  assert.ok(entries.every((entry) => monsterLibrary.getTemplate(entry.id)));
  assert.equal(monsterLibrary.getTemplate('flesh-golem').speed, '');
});
