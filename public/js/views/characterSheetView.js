// public/js/views/characterSheetView.js
//
// Right-hand sidebar: for a player, their own character sheet; for the DM,
// every online player's full sheet. Both share the same card layout
// (buildCharacterCard), just with the edit button toggled on/off.

import { ABILITY_KEYS } from '/shared/schema.js';
import { activeCharacter, dmRoster } from '../state.js';
import { openCharacterModal } from './characterModalView.js';

const ownCharacterView = document.getElementById('own-character-view');
const allCharactersView = document.getElementById('all-characters-view');

function abilityMod(score) {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function hpBarClass(current, max) {
  if (max <= 0) return '';
  const pct = current / max;
  if (pct <= 0.25) return 'critical';
  if (pct <= 0.5) return 'hurt';
  return '';
}

function buildCharacterCard(character, { showEditButton }) {
  const card = document.createElement('div');
  card.className = 'char-sheet-card';

  const name = document.createElement('div');
  name.className = 'char-sheet-name';
  name.textContent = character.name;

  const meta = document.createElement('div');
  meta.className = 'char-sheet-meta';
  meta.textContent = `Level ${character.level} ${character.race ? character.race + ' ' : ''}${character.class || ''}`;

  const stats = document.createElement('div');
  stats.className = 'char-sheet-stats';
  stats.innerHTML = `<div>AC <strong>${character.ac}</strong></div><div>HP <strong>${character.hp.current}/${character.hp.max}</strong></div>`;

  const hpTrack = document.createElement('div');
  hpTrack.className = 'hp-bar-track';
  const hpFill = document.createElement('div');
  const pct = character.hp.max > 0 ? Math.max(0, Math.min(100, (character.hp.current / character.hp.max) * 100)) : 0;
  hpFill.className = 'hp-bar-fill ' + hpBarClass(character.hp.current, character.hp.max);
  hpFill.style.width = pct + '%';
  hpTrack.appendChild(hpFill);

  const abilities = document.createElement('div');
  abilities.className = 'char-sheet-abilities';
  ABILITY_KEYS.forEach((key) => {
    const score = character.abilityScores[key];
    const pill = document.createElement('div');
    pill.className = 'ability-pill';
    pill.innerHTML = `${key.toUpperCase()}<span class="val">${score}</span>${abilityMod(score)}`;
    abilities.appendChild(pill);
  });

  card.append(name, meta, stats, hpTrack, abilities);

  if (character.notes) {
    const notes = document.createElement('div');
    notes.className = 'char-sheet-notes';
    notes.textContent = character.notes;
    card.appendChild(notes);
  }

  if (showEditButton) {
    const editBtn = document.createElement('button');
    editBtn.className = 'char-sheet-edit-btn';
    editBtn.textContent = 'Edit Character Sheet';
    editBtn.addEventListener('click', () => openCharacterModal(character, 'edit-in-game'));
    card.appendChild(editBtn);
  }

  return card;
}

export function renderOwnCharacterView() {
  ownCharacterView.innerHTML = '';
  if (!activeCharacter) return;
  ownCharacterView.appendChild(buildCharacterCard(activeCharacter, { showEditButton: true }));
}

export function renderDMRoster() {
  allCharactersView.innerHTML = '';
  if (dmRoster.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'dm-roster-empty';
    empty.textContent = 'No players online yet.';
    allCharactersView.appendChild(empty);
    return;
  }
  dmRoster.forEach(({ username, character }) => {
    const label = document.createElement('div');
    label.className = 'char-sheet-meta';
    label.style.marginBottom = '4px';
    label.textContent = `Played by ${username}`;
    allCharactersView.appendChild(label);
    allCharactersView.appendChild(buildCharacterCard(character, { showEditButton: false }));
  });
}
