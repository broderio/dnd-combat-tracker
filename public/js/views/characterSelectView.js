// public/js/views/characterSelectView.js
//
// Step 2 of the join flow (players only): pick a saved character to play, or
// create a new one. Also owns `joinAsPlayer`, since both this screen's
// "Play" button and the character modal's "create-and-play" flow need to
// trigger the same join.

import { joinTable } from "../socketClient.js";
import {
  currentCharacters,
  currentUsername,
  setActiveCharacter,
  setCurrentCharacters,
  setCurrentUsername,
  setSession,
} from "../state.js";

import { openCharacterModal } from "./characterModalView.js";

const joinScreen = document.getElementById("join-screen");
const characterSelectScreen = document.getElementById("character-select-screen");
const csUsername = document.getElementById("cs-username");
const characterSelectList = document.getElementById("character-select-list");
const noCharactersMsg = document.getElementById("no-characters-msg");
const createCharacterBtn = document.getElementById("create-character-btn");
const logoutBtn = document.getElementById("logout-btn");

export function showCharacterSelectScreen() {
  joinScreen.classList.add("hidden");
  characterSelectScreen.classList.remove("hidden");
  csUsername.textContent = currentUsername;
  renderCharacterSelectList();
}

export function renderCharacterSelectList() {
  characterSelectList.innerHTML = "";
  noCharactersMsg.classList.toggle("hidden", currentCharacters.length > 0);

  currentCharacters.forEach((c) => {
    const li = document.createElement("li");

    const info = document.createElement("div");
    info.className = "char-card-info";
    const nameEl = document.createElement("div");
    nameEl.className = "char-card-name";
    nameEl.textContent = c.name;
    const metaEl = document.createElement("div");
    metaEl.className = "char-card-meta";
    metaEl.textContent = `Level ${c.level} ${c.race ? c.race + " " : ""}${
      c.class || ""
    } · HP ${c.hp.current}/${c.hp.max} · AC ${c.ac}`;
    info.append(nameEl, metaEl);

    const actions = document.createElement("div");
    actions.className = "char-card-actions";

    const playBtn = document.createElement("button");
    playBtn.className = "play-btn";
    playBtn.textContent = "Play";
    playBtn.addEventListener("click", () => joinAsPlayer(c));

    const editBtn = document.createElement("button");
    editBtn.className = "edit-btn";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => openCharacterModal(c, "edit-in-list"));

    actions.append(playBtn, editBtn);
    li.append(info, actions);
    characterSelectList.appendChild(li);
  });
}

export function joinAsPlayer(character) {
  setActiveCharacter(character);
  setSession("player", currentUsername);
  joinTable({ mode: "player", name: currentUsername, characterId: character.id });
}

createCharacterBtn.addEventListener("click", () => openCharacterModal(null, "create-and-play"));

logoutBtn.addEventListener("click", () => {
  setCurrentUsername(null);
  setCurrentCharacters([]);
  characterSelectScreen.classList.add("hidden");
  joinScreen.classList.remove("hidden");
  document.getElementById("player-pin").value = "";
});
