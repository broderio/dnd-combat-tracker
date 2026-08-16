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
