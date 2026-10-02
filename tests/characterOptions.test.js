import test from 'node:test';
import assert from 'node:assert/strict';

import { characterOptionsLibrary } from '../server/characterOptions.js';

test('searchClasses filters by name substring, case-insensitively', () => {
  const results = characterOptionsLibrary.searchClasses({ name: 'wiz' });
  assert.ok(results.length > 0);
  for (const name of results) {
    assert.ok(name.toLowerCase().includes('wiz'));
  }
});

test('searchClasses with no name returns a non-empty bounded list', () => {
  const results = characterOptionsLibrary.searchClasses({});
  assert.ok(results.length > 0);
  assert.ok(results.length <= 30);
});

test('searchRaces respects an explicit limit', () => {
  const results = characterOptionsLibrary.searchRaces({ limit: 2 });
  assert.ok(results.length <= 2);
});

test('searchWeapons returns objects with name and description for a matching query', () => {
  const results = characterOptionsLibrary.searchWeapons({ name: 'sword' });
  assert.ok(results.length > 0);
  for (const w of results) {
    assert.ok(w.name.toLowerCase().includes('sword'));
    assert.equal(typeof w.description, 'string');
  }
});

test('searchSpells returns objects with name/level/school for a matching query', () => {
  const results = characterOptionsLibrary.searchSpells({ name: 'fire' });
  assert.ok(results.length > 0);
  for (const s of results) {
    assert.ok(s.name.toLowerCase().includes('fire'));
    assert.equal(typeof s.level, 'number');
  }
});

test('an unmatched name query returns an empty list rather than throwing', () => {
  assert.deepEqual(characterOptionsLibrary.searchSpells({ name: 'zzzznotarealspellzzzz' }), []);
});
