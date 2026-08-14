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

import { EVENTS } from "/shared/protocol.js";

import { onEvent } from "./socketClient.js";
import { board, setActiveCharacter, setBoard, setDmRoster, setOnlinePlayers } from "./state.js";
import { positionToken, refreshTokenVisual, render as renderBoard } from "./views/boardView.js";
import { renderDMRoster, renderOwnCharacterView } from "./views/characterSheetView.js";
import { renderOwnerDropdown, syncGridFormFromState } from "./views/dmPanelView.js";
import { renderOverlayList } from "./views/overlayPanelView.js";
import { renderInitiativeList, renderTurnBanner } from "./views/turnTrackerView.js";


const joinScreen = document.getElementById("join-screen");
const characterSelectScreen = document.getElementById("character-select-screen");
const gameScreen = document.getElementById("game-screen");

const roleBadge = document.getElementById("role-badge");
const presenceLog = document.getElementById("presence-log");
const dmPanel = document.getElementById("dm-panel");
const boardHint = document.getElementById("board-hint");
const charSidebarTitle = document.getElementById("char-sidebar-title");
const ownCharacterView = document.getElementById("own-character-view");
const allCharactersView = document.getElementById("all-characters-view");

onEvent("disconnect", () => {
  presenceLog.textContent = "Connection lost — attempting to reconnect…";
});

onEvent(EVENTS.JOINED, ({ mode, name }) => {
  presenceLog.textContent = "Connected.";
  joinScreen.classList.add("hidden");
  characterSelectScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
  roleBadge.textContent = mode === "dm" ? `DM · ${name}` : `Player · ${name}`;

  if (mode === "dm") {
    dmPanel.classList.remove("hidden");
    boardHint.classList.add("hidden");
    charSidebarTitle.textContent = "All Characters";
    ownCharacterView.classList.add("hidden");
    allCharactersView.classList.remove("hidden");
  } else {
    dmPanel.classList.add("hidden");
    boardHint.classList.remove("hidden");
    charSidebarTitle.textContent = "Character Sheet";
    ownCharacterView.classList.remove("hidden");
    allCharactersView.classList.add("hidden");
    renderOwnCharacterView();
  }
});

onEvent(EVENTS.PRESENCE, ({ message }) => {
  presenceLog.textContent = message;
});

onEvent(EVENTS.YOUR_CHARACTER, (character) => {
  setActiveCharacter(character);
  renderOwnCharacterView();
});

onEvent(EVENTS.ALL_CHARACTERS, (roster) => {
  setDmRoster(roster);
  renderDMRoster();
});

onEvent(EVENTS.PLAYERS_ONLINE, (list) => {
  setOnlinePlayers(list);
  renderOwnerDropdown();
});

// ---------- Board/grid/token state sync ----------
onEvent(EVENTS.STATE, (newState) => {
  setBoard(newState);
  renderBoard();
  syncGridFormFromState();
  renderOverlayList();
  renderInitiativeList();
  renderTurnBanner();
});

onEvent(EVENTS.TOKEN_MOVED, ({ id, col, row, overlayEffects }) => {
  if (!board.tokens[id]) return;
  board.tokens[id].col = col;
  board.tokens[id].row = row;
  if (overlayEffects) board.tokens[id].overlayEffects = overlayEffects;
  positionToken(id);
  refreshTokenVisual(id);
});
