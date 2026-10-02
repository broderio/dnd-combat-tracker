import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getCharacterFeatures,
  resolveChoiceOptions,
  setBuildSelection,
  setBuildSpell,
} from '../shared/characterBuilder.js';

test('getCharacterFeatures combines class and subclass features through the chosen level', () => {
  const features = getCharacterFeatures({
    featuresByLevel: {
      1: [{ name: 'First', description: 'Class level one' }],
      3: [{ name: 'Third', description: 'Class level three' }],
    },
  }, {
    featuresByLevel: { 2: [{ name: 'Archetype', description: 'Subclass level two' }] },
  }, 2);

  assert.deepEqual(features.map(({ name, level, source }) => ({ name, level, source })), [
    { name: 'First', level: 1, source: 'class' },
    { name: 'Archetype', level: 2, source: 'subclass' },
  ]);
});

test('resolveChoiceOptions filters spell and fighting-style options from local catalogs', () => {
  const catalogs = {
    spells: [
      { id: 'spark', name: 'Spark', level: 0, classes: [{ id: 'wizard' }] },
      { id: 'fireball', name: 'Fireball', level: 3, classes: [{ id: 'wizard' }] },
      { id: 'heal', name: 'Heal', level: 1, classes: [{ id: 'cleric' }] },
    ],
    feats: [
      { id: 'defense', name: 'Defense', category: 'Fighting Style Feats' },
      { id: 'alert', name: 'Alert', category: 'Origin Feats' },
    ],
  };

  assert.deepEqual(resolveChoiceOptions({ optionSource: { type: 'spell-list', id: 'class-spell-list', spellKind: 'cantrip' } }, {
    catalogs,
    classId: 'wizard',
  }).items.map((item) => item.id), ['spark']);
  assert.deepEqual(resolveChoiceOptions({ feature: 'Fighting Style', optionSource: { type: 'feat-list' } }, { catalogs }).items.map((item) => item.id), ['defense']);
});

test('resolveChoiceOptions marks unresolved sources as unsupported instead of returning silent emptiness', () => {
  const result = resolveChoiceOptions({ optionSource: { type: 'future-source' } });
  assert.equal(result.supported, false);
  assert.match(result.reason, /not supported/);
});

test('setBuildSelection and setBuildSpell preserve independent build entries', () => {
  const build = {
    selections: [{ choiceId: 'class:skills', selectedOptionIds: ['perception'] }],
    spells: [{ spellId: 'shield', status: 'prepared', sourceClassId: 'wizard' }],
  };
  const withSelection = setBuildSelection(build, 'class:feat', ['alert', 'alert', '../invalid']);
  const withSpell = setBuildSpell(withSelection, { id: 'fireball' }, { status: 'known', sourceClassId: 'wizard' });

  assert.deepEqual(withSpell.selections, [
    { choiceId: 'class:skills', selectedOptionIds: ['perception'] },
    { choiceId: 'class:feat', selectedOptionIds: ['alert'] },
  ]);
  assert.deepEqual(withSpell.spells, [
    { spellId: 'shield', status: 'prepared', sourceClassId: 'wizard' },
    { spellId: 'fireball', status: 'known', sourceClassId: 'wizard' },
  ]);
});
