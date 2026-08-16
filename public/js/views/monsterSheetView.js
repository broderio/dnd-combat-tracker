import { EVENTS } from '/shared/protocol.js';

import { socketClient } from '../socketClient.js';
import { clientState } from '../state.js';

import { buildQuickEditControls } from './quickEditControls.js';
import {
  buildAttacksList,
  buildFeatureList,
  buildSpellcastingContent,
  buildAbilityScoreGrid,
  buildRowsGrid,
  buildDescriptionContent,
  buildSpellSlotsRow,
  buildSheetCard,
} from './sheetCardView.js';

const monstersView = document.getElementById('monsters-view');

export function monsterBadgeLabel(combatantId) {
  const match = /(\d+)$/.exec(combatantId || ''); // e.g. "moninst_42" → "42"
  return match ? `#${match[1]}` : '';
}

// Traits, non-attack Actions (e.g. Multiattack), Bonus Actions, Reactions,
// and Legendary Actions are all the same { name, desc } shape in the
// underlying data — grouped into one section with a small tag per entry
// instead of five mostly-empty dropdowns.
function buildFeatureEntries(instance) {
  const nonAttackActions = (instance.actions || []).filter((a) => a.toHit === null && a.damage === null);
  return [
    ...(instance.traits || []).map((f) => ({ ...f, tag: 'Trait' })),
    ...nonAttackActions.map((f) => ({ ...f, tag: 'Action' })),
    ...(instance.bonusActions || []).map((f) => ({ ...f, tag: 'Bonus Action' })),
    ...(instance.reactions || []).map((f) => ({ ...f, tag: 'Reaction' })),
    ...(instance.legendaryActions || []).map((f) => ({ ...f, tag: 'Legendary' })),
  ];
}

function buildStatBlockContent(instance) {
  const wrap = document.createElement('div');

  const abilityGrid = buildAbilityScoreGrid(instance.abilityScores, instance.abilityModifiers);
  if (abilityGrid) wrap.appendChild(abilityGrid);

  const grid = buildRowsGrid([
    ['Saving Throws', instance.savingThrows],
    ['Skills', instance.skills],
    ['Senses', instance.senses],
    ['Passive Perception', instance.passivePerception],
    ['Languages', instance.languages],
    ['Condition Immunities', instance.conditionImmunities],
    ['Damage Immunities', instance.damageImmunities],
    ['Damage Resistances', instance.damageResistances],
    ['Damage Vulnerabilities', instance.damageVulnerabilities],
    ['Hit Dice', instance.hitDice],
    ['Proficiency Bonus', instance.proficiencyBonus],
    ['XP', instance.xp],
    ['Source', instance.source],
  ]);
  if (grid) wrap.appendChild(grid);

  return wrap.childElementCount ? wrap : null;
}

function buildMonsterCard(instance) {
  const crText = instance.cr === null || instance.cr === undefined ? '?' : instance.cr;

  const quickEditEl = buildQuickEditControls(instance.hp, instance.statusEffects, {
    onAdjustHp: (delta) => {
      const next = Math.max(-9999, Math.min(9999, instance.hp.current + delta));
      socketClient.emitEvent(EVENTS.UPDATE_MONSTER_INSTANCE, { id: instance.id, hp: { current: next } });
    },
    onSetCurrentHp: (current) => {
      socketClient.emitEvent(EVENTS.UPDATE_MONSTER_INSTANCE, { id: instance.id, hp: { current } });
    },
    onSetMaxHp: (max) => {
      socketClient.emitEvent(EVENTS.UPDATE_MONSTER_INSTANCE, { id: instance.id, hp: { max } });
    },
    onToggleEffect: (effect, checked) => {
      const current = new Set(instance.statusEffects || []);
      if (checked) current.add(effect);
      else current.delete(effect);
      socketClient.emitEvent(EVENTS.UPDATE_MONSTER_INSTANCE, {
        id: instance.id,
        statusEffects: Array.from(current),
      });
    },
  });

  const featureEntries = buildFeatureEntries(instance);

  return buildSheetCard({
    badge: monsterBadgeLabel(instance.id),
    name: instance.name,
    meta: `${instance.size || ''} ${instance.type || ''} · CR ${crText}`.trim(),
    stats: [
      ['AC', instance.ac],
      ['Speed', instance.speed || '—'],
    ],
    hp: instance.hp,
    spellSlotsEl: buildSpellSlotsRow(instance.spellSlots, (level, nextCurrent) => {
      socketClient.emitEvent(EVENTS.UPDATE_MONSTER_INSTANCE, { id: instance.id, spellSlots: { [level]: nextCurrent } });
    }),
    quickEditEl,
    sections: [
      { title: 'Attacks', contentEl: buildAttacksList(instance.attacks), open: true, count: instance.attacks?.length },
      {
        title: 'Traits & Special Actions',
        contentEl: buildFeatureList(featureEntries),
        count: featureEntries.length,
      },
      { title: 'Spellcasting', contentEl: buildSpellcastingContent(instance.spellcasting) },
      { title: 'Stat Block', contentEl: buildStatBlockContent(instance) },
      { title: 'Description', contentEl: buildDescriptionContent(instance.description) },
    ],
  });
}

/** Renders every placed monster instance into the Monsters sidebar — DM-only, a no-op for players. */
export function renderMonsterSidebar() {
  if (clientState.session.mode !== 'dm') return;
  monstersView.innerHTML = '';
  const instances = Object.values(clientState.dmMonsterInstances);
  if (instances.length === 0) return;
  instances.forEach((instance) => monstersView.appendChild(buildMonsterCard(instance)));
}
