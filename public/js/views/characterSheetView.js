import { buildQuickEditControls as sharedBuildQuickEditControls } from './quickEditControls.js';
import {
  buildAttacksList,
  buildFeatureList,
  buildFlatSpellList,
  buildAbilityScoreGrid,
  computeModifiers,
  buildSpellSlotsRow,
  buildSheetCard,
} from './sheetCardView.js';

import { ApiClient } from '../api.js';
import { clientState } from '../state.js';

import { openCharacterModal } from './characterModalView.js';

const ownCharacterView = document.getElementById('own-character-view');
const allCharactersView = document.getElementById('all-characters-view');

function buildCharacterCard(character, { showEditButton, showQuickEdit, username }) {
  let editButtonEl = null;
  if (showEditButton) {
    editButtonEl = document.createElement('button');
    editButtonEl.className = 'char-sheet-edit-btn';
    editButtonEl.textContent = 'Edit Character Sheet';
    editButtonEl.addEventListener('click', () => openCharacterModal(character, 'edit-in-game'));
  }

  // Spell slots are self-service (a player spending their own slots mid-combat), so they're
  // spendable both on the player's own sheet and from the DM roster — unlike HP quick-edit,
  // which is DM-only.
  const slotOwner = username || clientState.currentUsername;
  const spellSlotsEl =
    showEditButton || showQuickEdit
      ? buildSpellSlotsRow(character.spellSlots, (level, nextCurrent) => {
          ApiClient.updateCharacter(slotOwner, character.id, { spellSlots: { [level]: nextCurrent } });
        })
      : null;

  const card = buildSheetCard({
    name: character.name,
    meta: `Level ${character.level} ${character.race ? character.race + ' ' : ''}${character.class || ''}`,
    stats: [
      ['AC', character.ac],
      ['HP', `${character.hp.current}/${character.hp.max}`],
    ],
    hp: character.hp,
    spellSlotsEl,
    topAbilitiesEl: buildAbilityScoreGrid(character.abilityScores, computeModifiers(character.abilityScores)),
    notes: character.notes,
    quickEditEl: showQuickEdit ? buildQuickEditControls(username, character) : null,
    editButtonEl,
    sections: [
      { title: 'Attacks', contentEl: buildAttacksList(character.attacks), count: character.attacks?.length },
      { title: 'Features', contentEl: buildFeatureList(character.features), count: character.features?.length },
      { title: 'Spells', contentEl: buildFlatSpellList(character.spells), count: character.spells?.length },
    ],
  });

  return card;
}

function buildQuickEditControls(username, character) {
  return sharedBuildQuickEditControls(character.hp, character.statusEffects, {
    onAdjustHp: (delta) => {
      const next = Math.max(-9999, Math.min(9999, character.hp.current + delta));
      ApiClient.updateCharacter(username, character.id, { hp: { current: next } });
    },
    onSetCurrentHp: (current) => {
      ApiClient.updateCharacter(username, character.id, { hp: { current } });
    },
    onSetMaxHp: (max) => {
      ApiClient.updateCharacter(username, character.id, { hp: { max } });
    },
    onToggleEffect: (effect, checked) => {
      const current = new Set(character.statusEffects || []);
      if (checked) current.add(effect);
      else current.delete(effect);
      ApiClient.updateCharacter(username, character.id, { statusEffects: Array.from(current) });
    },
  });
}


export function renderOwnCharacterView() {
  ownCharacterView.innerHTML = '';
  if (!clientState.activeCharacter) return;
  ownCharacterView.appendChild(buildCharacterCard(clientState.activeCharacter, { showEditButton: true }));
}

export function renderDMRoster() {
  allCharactersView.innerHTML = '';
  if (clientState.dmRoster.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'dm-roster-empty';
    empty.textContent = 'No players online yet.';
    allCharactersView.appendChild(empty);
    return;
  }
  clientState.dmRoster.forEach(({ username, character }) => {
    const label = document.createElement('div');
    label.className = 'char-sheet-meta';
    label.style.marginBottom = '4px';
    label.textContent = `Played by ${username}`;
    allCharactersView.appendChild(label);
    allCharactersView.appendChild(
      buildCharacterCard(character, { showEditButton: false, showQuickEdit: true, username })
    );
  });
}
