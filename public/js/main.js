// public/js/main.js
//
// Entry point (loaded via `<script type="module" src="js/main.js">` in
// index.html). Importing each view module runs its top-level DOM wiring
// (event listeners) exactly once — ES modules are only evaluated the first
// time they're imported, no matter how many other files import them.
//
// This file itself only owns the "game screen shell": showing/hiding the
// DM panel vs. player board-hint, the role badge, and the presence log —
// things that aren't really part of any single panel below.

import "./views/joinView.js";
import "./views/characterSelectView.js";
import "./views/characterModalView.js";
import "./views/measureToolView.js";
import "./views/diceRollerView.js";

import { EVENTS } from "/shared/protocol.js";

import { socketClient } from "./socketClient.js";
import { clientState } from "./state.js";
import { positionToken, refreshTokenVisual, render as renderBoard } from "./views/boardView.js";
import { renderDMRoster, renderOwnCharacterView } from "./views/characterSheetView.js";
import { renderOwnerDropdown, syncGridFormFromState } from "./views/dmPanelView.js";
import { renderMonsterSidebar } from "./views/monsterSheetView.js";
import { renderOverlayList } from "./views/overlayPanelView.js";
import { renderInitiativeList, renderTurnBanner } from "./views/turnTrackerView.js";


const joinScreen = document.getElementById("join-screen");
const characterSelectScreen = document.getElementById("character-select-screen");
const gameScreen = document.getElementById("game-screen");

const roleBadge = document.getElementById("role-badge");
const presenceLog = document.getElementById("presence-log");
const dmPanel = document.getElementById("dm-panel");
const monstersSidebar = document.getElementById("monsters-sidebar");
const charSidebarTitle = document.getElementById("char-sidebar-title");
const ownCharacterView = document.getElementById("own-character-view");
const allCharactersView = document.getElementById("all-characters-view");

socketClient.onEvent("disconnect", () => {
  presenceLog.textContent = "Connection lost — attempting to reconnect…";
});

socketClient.onEvent(EVENTS.JOINED, ({ mode, name }) => {
  presenceLog.textContent = "Connected.";
  joinScreen.classList.add("hidden");
  characterSelectScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
  roleBadge.textContent = mode === "dm" ? `DM · ${name}` : `Player · ${name}`;

  if (mode === "dm") {
    dmPanel.classList.remove("hidden");
    monstersSidebar.classList.remove("hidden");
    charSidebarTitle.textContent = "All Characters";
    ownCharacterView.classList.add("hidden");
    allCharactersView.classList.remove("hidden");
  } else {
    dmPanel.classList.add("hidden");
    monstersSidebar.classList.add("hidden");
    charSidebarTitle.textContent = "Character Sheet";
    ownCharacterView.classList.remove("hidden");
    allCharactersView.classList.add("hidden");
    renderOwnCharacterView();
  }
});

socketClient.onEvent(EVENTS.PRESENCE, ({ message }) => {
  presenceLog.textContent = message;
});

socketClient.onEvent(EVENTS.YOUR_CHARACTER, (character) => {
  clientState.setActiveCharacter(character);
  renderOwnCharacterView();
});

socketClient.onEvent(EVENTS.ALL_CHARACTERS, (roster) => {
  clientState.setDmRoster(roster);
  renderDMRoster();
});

socketClient.onEvent(EVENTS.ALL_MONSTER_INSTANCES, (instances) => {
  clientState.setDmMonsterInstances(instances);
  renderMonsterSidebar();
});

socketClient.onEvent(EVENTS.PLAYERS_ONLINE, (list) => {
  clientState.setOnlinePlayers(list);
  renderOwnerDropdown();
});

// ---------- Board/grid/token state sync ----------
socketClient.onEvent(EVENTS.STATE, (newState) => {
  clientState.setBoard(newState);
  renderBoard();
  syncGridFormFromState();
  renderOverlayList();
  renderInitiativeList();
  renderTurnBanner();
});

socketClient.onEvent(EVENTS.TOKEN_MOVED, ({ id, col, row }) => {
  if (!clientState.board.tokens[id]) return;
  clientState.board.tokens[id].col = col;
  clientState.board.tokens[id].row = row;
  positionToken(id);
  refreshTokenVisual(id);
});
