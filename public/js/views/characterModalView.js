// public/js/views/characterModalView.js
//
// The create/edit character form modal — reused both before joining the
// table (create-and-play, edit-in-list) and mid-game (edit-in-game from the
// character sheet sidebar).

import { defaultCharacter } from "/shared/schema.js";

import { createCharacter, updateCharacter } from "../api.js";
import { currentUsername, setActiveCharacter, setCurrentCharacters } from "../state.js";

import { joinAsPlayer, renderCharacterSelectList } from "./characterSelectView.js";
import { renderOwnCharacterView } from "./characterSheetView.js";

const characterModal = document.getElementById("character-modal");
const characterModalTitle = document.getElementById("character-modal-title");
const cfCancelBtn = document.getElementById("cf-cancel-btn");
const cfSaveBtn = document.getElementById("cf-save-btn");

// Which flow opened the modal, so Save knows what to do afterwards:
//   'create-and-play' -> join the table as the newly-created character
//   'edit-in-list'     -> just refresh the character-select list
//   'edit-in-game'     -> refresh the in-game sidebar's own-character view
//   'edit-as-dm'       -> DM editing a linked player's character from the
//                         token editor; the DM roster refresh happens
//                         automatically via the server's ALL_CHARACTERS
//                         broadcast, so there's nothing extra to do locally
let editingContext = null;
let editingCharacterId = null;
let editingUsername = null; // whose character this is (usually currentUsername, but not for 'edit-as-dm')

/**
 * Opens the modal. Pass `character: null` to create a new one. `ownerUsername`
 * defaults to the logged-in user (`currentUsername`) — pass it explicitly
 * when the DM is editing a different player's character (context
 * 'edit-as-dm'), since the DM's own username isn't the character's owner.
 */
export function openCharacterModal(character, context, ownerUsername) {
  editingContext = context;
  editingCharacterId = character ? character.id : null;
  editingUsername = ownerUsername || currentUsername;
  characterModalTitle.textContent = character ? `Edit ${character.name}` : "New Character";

  const c = character || defaultCharacter();

  document.getElementById("cf-name").value = c.name;
  document.getElementById("cf-class").value = c.class;
  document.getElementById("cf-race").value = c.race;
  document.getElementById("cf-level").value = c.level;
  document.getElementById("cf-ac").value = c.ac;
  document.getElementById("cf-hp-current").value = c.hp.current;
  document.getElementById("cf-hp-max").value = c.hp.max;
  document.getElementById("cf-str").value = c.abilityScores.str;
  document.getElementById("cf-dex").value = c.abilityScores.dex;
  document.getElementById("cf-con").value = c.abilityScores.con;
  document.getElementById("cf-int").value = c.abilityScores.int;
  document.getElementById("cf-wis").value = c.abilityScores.wis;
  document.getElementById("cf-cha").value = c.abilityScores.cha;
  document.getElementById("cf-notes").value = c.notes || "";
  document.getElementById("cf-token-color").value = c.tokenColor || "#e63946";

  characterModal.classList.remove("hidden");
}

cfCancelBtn.addEventListener("click", () => characterModal.classList.add("hidden"));

cfSaveBtn.addEventListener("click", async () => {
  const payload = {
    name: document.getElementById("cf-name").value.trim() || "Unnamed",
    class: document.getElementById("cf-class").value.trim(),
    race: document.getElementById("cf-race").value.trim(),
    level: document.getElementById("cf-level").value,
    ac: document.getElementById("cf-ac").value,
    hp: {
      current: document.getElementById("cf-hp-current").value,
      max: document.getElementById("cf-hp-max").value,
    },
    abilityScores: {
      str: document.getElementById("cf-str").value,
      dex: document.getElementById("cf-dex").value,
      con: document.getElementById("cf-con").value,
      int: document.getElementById("cf-int").value,
      wis: document.getElementById("cf-wis").value,
      cha: document.getElementById("cf-cha").value,
    },
    notes: document.getElementById("cf-notes").value,
    tokenColor: document.getElementById("cf-token-color").value,
  };

  try {
    const data = editingCharacterId
      ? await updateCharacter(editingUsername, editingCharacterId, payload)
      : await createCharacter(editingUsername, payload);

    if (!data.ok) {
      alert(data.error || "Could not save character.");
      return;
    }

    if (editingUsername === currentUsername) setCurrentCharacters(data.characters);
    characterModal.classList.add("hidden");

    if (editingContext === "create-and-play") {
      joinAsPlayer(data.character);
    } else if (editingContext === "edit-in-list") {
      renderCharacterSelectList();
    } else if (editingContext === "edit-in-game") {
      setActiveCharacter(data.character);
      renderOwnCharacterView();
    }
    // 'edit-as-dm': nothing else to do — the server's ALL_CHARACTERS broadcast
    // (triggered by the PUT request above) refreshes the DM roster for us.
  } catch (err) {
    alert("Could not reach the server.");
  }
});
