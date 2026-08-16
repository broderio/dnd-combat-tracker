import { Character } from '/shared/schema.js';
import { ApiClient } from '../api.js';
import { clientState } from '../state.js';
import { renderCharacterSelectList } from './characterSelectView.js';
import { renderOwnCharacterView } from './characterSheetView.js';

const characterModal = document.getElementById('character-modal');
const characterModalTitle = document.getElementById('character-modal-title');
const cfCancelBtn = document.getElementById('cf-cancel-btn');
const cfDeleteBtn = document.getElementById('cf-delete-btn');
const cfSaveBtn = document.getElementById('cf-save-btn');

const cfClassInput = document.getElementById('cf-class');
const cfRaceInput = document.getElementById('cf-race');
const cfClassOptions = document.getElementById('cf-class-options');
const cfRaceOptions = document.getElementById('cf-race-options');

const cfAttackSearch = document.getElementById('cf-attack-search');
const cfWeaponOptions = document.getElementById('cf-weapon-options');
const cfAttackToHit = document.getElementById('cf-attack-tohit');
const cfAttackDamage = document.getElementById('cf-attack-damage');
const cfAttackDamageType = document.getElementById('cf-attack-damagetype');
const cfAttackDesc = document.getElementById('cf-attack-desc');
const cfAddAttackBtn = document.getElementById('cf-add-attack-btn');
const cfAttacksList = document.getElementById('cf-attacks-list');

const cfSpellSearch = document.getElementById('cf-spell-search');
const cfSpellOptions = document.getElementById('cf-spell-options');
const cfAddSpellBtn = document.getElementById('cf-add-spell-btn');
const cfSpellsList = document.getElementById('cf-spells-list');

const cfFeatureName = document.getElementById('cf-feature-name');
const cfFeatureDesc = document.getElementById('cf-feature-desc');
const cfAddFeatureBtn = document.getElementById('cf-add-feature-btn');
const cfFeaturesList = document.getElementById('cf-features-list');

/** Debounces a datalist-populating search so we don't fire a request per keystroke. */
function debounceDatalist(input, datalist, searchFn, { onResults } = {}) {
  let timer = null;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    const query = input.value.trim();
    if (!query) {
      datalist.innerHTML = '';
      return;
    }
    timer = setTimeout(async () => {
      try {
        const results = await searchFn(query);
        datalist.innerHTML = '';
        results.forEach((value) => {
          const option = document.createElement('option');
          option.value = typeof value === 'string' ? value : value.name;
          datalist.appendChild(option);
        });
        if (onResults) onResults(results);
      } catch {
        // Ignore transient lookup failures — the field stays freely editable either way.
      }
    }, 200);
  });
}

debounceDatalist(cfClassInput, cfClassOptions, async (q) => (await ApiClient.searchClasses(q)).classes || []);
debounceDatalist(cfRaceInput, cfRaceOptions, async (q) => (await ApiClient.searchRaces(q)).races || []);

debounceDatalist(cfAttackSearch, cfWeaponOptions, async (q) => (await ApiClient.searchWeapons(q)).weapons || []);

let spellResultsByName = new Map();
debounceDatalist(cfSpellSearch, cfSpellOptions, async (q) => (await ApiClient.searchSpells(q)).spells || [], {
  onResults: (results) => {
    spellResultsByName = new Map(results.map((s) => [s.name, s]));
  },
});

function buildEntryRow(label, onRemove) {
  const row = document.createElement('div');
  row.className = 'cf-entry-row';
  const labelEl = document.createElement('span');
  labelEl.innerHTML = label;
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'cf-entry-remove-btn';
  removeBtn.textContent = '✕';
  removeBtn.addEventListener('click', onRemove);
  row.append(labelEl, removeBtn);
  return row;
}

export class CharacterModalView {
  constructor() {
    this.editingContext = null; // Which flow opened the modal, so Save knows what to do afterwards.
    //   'create-and-play'  -> join the table as the newly-created character
    //   'edit-in-list'     -> just refresh the character-select list
    //   'edit-in-game'     -> refresh the in-game sidebar's own-character view
    //   'edit-as-dm'       -> DM editing a linked player's character from the token editor; the DM roster refresh
    //                         happens automatically via the server's ALL_CHARACTERS broadcast, so there's nothing
    //                         extra to do locally

    this.editingCharacterId = null; // the character being edited, or null if creating a new one
    this.editingUsername = null; // whose character this is (usually currentUsername, but not for 'edit-as-dm')

    // Working copies of the searchable-picker-backed lists, edited in the
    // modal and only written back onto the character on Save.
    this.attacks = [];
    this.spells = [];
    this.features = [];

    cfAddAttackBtn.addEventListener('click', () => this.addAttack());
    cfAddSpellBtn.addEventListener('click', () => this.addSpell());
    cfAddFeatureBtn.addEventListener('click', () => this.addFeature());
  }

  addAttack() {
    const name = cfAttackSearch.value.trim();
    if (!name) return;
    this.attacks.push({
      name,
      toHit: cfAttackToHit.value.trim() || null,
      damage: cfAttackDamage.value.trim() || null,
      damageType: cfAttackDamageType.value.trim() || null,
      desc: cfAttackDesc.value.trim(),
    });
    cfAttackSearch.value = '';
    cfAttackToHit.value = '';
    cfAttackDamage.value = '';
    cfAttackDamageType.value = '';
    cfAttackDesc.value = '';
    this.renderAttacksList();
  }

  addSpell() {
    const name = cfSpellSearch.value.trim();
    if (!name) return;
    const known = spellResultsByName.get(name);
    this.spells.push({ name, level: known ? known.level : 0, school: known ? known.school : null });
    cfSpellSearch.value = '';
    this.renderSpellsList();
  }

  addFeature() {
    const name = cfFeatureName.value.trim();
    if (!name) return;
    this.features.push({ name, desc: cfFeatureDesc.value.trim() });
    cfFeatureName.value = '';
    cfFeatureDesc.value = '';
    this.renderFeaturesList();
  }

  renderAttacksList() {
    cfAttacksList.innerHTML = '';
    this.attacks.forEach((attack, index) => {
      const parts = [attack.toHit ? `${attack.toHit} to hit` : null, attack.damage ? attack.damage : null].filter(
        Boolean
      );
      const label = `<strong>${attack.name}</strong>${parts.length ? ' — ' + parts.join(', ') : ''}`;
      cfAttacksList.appendChild(
        buildEntryRow(label, () => {
          this.attacks.splice(index, 1);
          this.renderAttacksList();
        })
      );
    });
  }

  renderSpellsList() {
    cfSpellsList.innerHTML = '';
    this.spells.forEach((spell, index) => {
      const levelLabel = spell.level ? `Level ${spell.level}` : 'Cantrip';
      const label = `<strong>${spell.name}</strong> — ${levelLabel}`;
      cfSpellsList.appendChild(
        buildEntryRow(label, () => {
          this.spells.splice(index, 1);
          this.renderSpellsList();
        })
      );
    });
  }

  renderFeaturesList() {
    cfFeaturesList.innerHTML = '';
    this.features.forEach((feature, index) => {
      cfFeaturesList.appendChild(
        buildEntryRow(`<strong>${feature.name}</strong>`, () => {
          this.features.splice(index, 1);
          this.renderFeaturesList();
        })
      );
    });
  }

  /**
   * Opens the modal. Pass `character: null` to create a new one.
   * `ownerUsername` defaults to the logged-in user (`clientState.currentUsername`)
   * pass it explicitly when the DM is editing a different player's character (context 'edit-as-dm'), since the DM's
   * own username isn't the character's owner.
   */
  open(character, context, ownerUsername) {
    this.editingContext = context;
    this.editingCharacterId = character ? character.id : null;
    this.editingUsername = ownerUsername || clientState.currentUsername;
    characterModalTitle.textContent = character ? `${character.name}` : 'New Character';

    const c = character || Character.default();

    document.getElementById('cf-name').value = c.name;
    document.getElementById('cf-class').value = c.class;
    document.getElementById('cf-race').value = c.race;
    document.getElementById('cf-level').value = c.level;
    document.getElementById('cf-ac').value = c.ac;
    document.getElementById('cf-hp-current').value = c.hp.current;
    document.getElementById('cf-hp-max').value = c.hp.max;
    document.getElementById('cf-str').value = c.abilityScores.str;
    document.getElementById('cf-dex').value = c.abilityScores.dex;
    document.getElementById('cf-con').value = c.abilityScores.con;
    document.getElementById('cf-int').value = c.abilityScores.int;
    document.getElementById('cf-wis').value = c.abilityScores.wis;
    document.getElementById('cf-cha').value = c.abilityScores.cha;
    document.getElementById('cf-notes').value = c.notes || '';
    document.getElementById('cf-token-color').value = c.tokenColor || '#e63946';

    this.attacks = (c.attacks || []).map((a) => ({ ...a }));
    this.spells = (c.spells || []).map((s) => ({ ...s }));
    this.features = (c.features || []).map((f) => ({ ...f }));
    this.renderAttacksList();
    this.renderSpellsList();
    this.renderFeaturesList();
    cfAttackSearch.value = '';
    cfAttackToHit.value = '';
    cfAttackDamage.value = '';
    cfAttackDamageType.value = '';
    cfAttackDesc.value = '';
    cfSpellSearch.value = '';
    cfFeatureName.value = '';
    cfFeatureDesc.value = '';

    characterModal.classList.remove('hidden');

    if (
      this.editingContext === 'edit-as-dm' ||
      this.editingContext === 'create-and-play' ||
      this.editingContext === 'edit-in-game'
    ) {
      cfDeleteBtn.classList.add('hidden');
    } else {
      cfDeleteBtn.classList.remove('hidden');
    }
  }


  async delete() {
    if (!this.editingCharacterId) {
      alert('Cannot delete a character that has not been saved yet.');
      return;
    }

    if (!confirm('Are you sure you want to delete this character? This cannot be undone.')) return;

    try {
      const data = await ApiClient.deleteCharacter(this.editingUsername, this.editingCharacterId);
      if (!data.ok) {
        alert(data.error || 'Could not delete character.');
        return;
      }

      if (this.editingUsername === clientState.currentUsername) clientState.setCurrentCharacters(data.characters);
      characterModal.classList.add('hidden');

      if (this.editingContext === 'edit-in-list') {
        renderCharacterSelectList();
      } else if (this.editingContext === 'edit-in-game') {
        clientState.setActiveCharacter(null);
        renderOwnCharacterView();
      }
      // 'edit-as-dm': nothing else to do. The server's ALL_CHARACTERS broadcast (triggered by the DELETE request above) refreshes the DM roster for us.
    } catch (err) {
      alert('Could not reach the server.');
    }
  }

  async save() {
    const payload = {
      name: document.getElementById('cf-name').value.trim() || 'Unnamed',
      class: document.getElementById('cf-class').value.trim(),
      race: document.getElementById('cf-race').value.trim(),
      level: document.getElementById('cf-level').value,
      ac: document.getElementById('cf-ac').value,
      hp: {
        current: document.getElementById('cf-hp-current').value,
        max: document.getElementById('cf-hp-max').value,
      },
      abilityScores: {
        str: document.getElementById('cf-str').value,
        dex: document.getElementById('cf-dex').value,
        con: document.getElementById('cf-con').value,
        int: document.getElementById('cf-int').value,
        wis: document.getElementById('cf-wis').value,
        cha: document.getElementById('cf-cha').value,
      },
      notes: document.getElementById('cf-notes').value,
      tokenColor: document.getElementById('cf-token-color').value,
      attacks: this.attacks,
      spells: this.spells,
      features: this.features,
    };

    try {
      const data = this.editingCharacterId
        ? await ApiClient.updateCharacter(this.editingUsername, this.editingCharacterId, payload)
        : await ApiClient.createCharacter(this.editingUsername, payload);

      if (!data.ok) {
        alert(data.error || 'Could not save character.');
        return;
      }

      if (this.editingUsername === clientState.currentUsername) clientState.setCurrentCharacters(data.characters);
      characterModal.classList.add('hidden');

      if (this.editingContext === 'create-and-play' || this.editingContext === 'edit-in-list') {
        renderCharacterSelectList();
      } else if (this.editingContext === 'edit-in-game') {
        clientState.setActiveCharacter(data.character);
        renderOwnCharacterView();
      }
      // 'edit-as-dm': nothing else to do. The server's ALL_CHARACTERS broadcast (triggered by the PUT request above)
      // refreshes the DM roster for us.
    } catch (err) {
      alert('Could not reach the server.');
    }
  }
}

export const characterModalView = new CharacterModalView();

cfCancelBtn.addEventListener('click', () => characterModal.classList.add('hidden'));
cfSaveBtn.addEventListener('click', () => characterModalView.save());
cfDeleteBtn.addEventListener('click', async () => characterModalView.delete());

export function openCharacterModal(character, context, ownerUsername) {
  characterModalView.open(character, context, ownerUsername);
}
