// public/js/views/dmPanelView.js
//
// The DM-only sidebar: background upload, grid configuration, and token
// management (add/remove, owner dropdown, "generate a token per online
// player"). Hidden entirely for players (see gameShell.js).

import { EVENTS } from "/shared/protocol.js";

import { ApiClient } from "../api.js";
import { socketClient } from "../socketClient.js";
import { clientState } from "../state.js";

import { buildTokenListItem } from "./tokenEditorView.js";

const uploadForm = document.getElementById("upload-form");
const backgroundInput = document.getElementById("background-input");
const gridCols = document.getElementById("grid-cols");
const gridRows = document.getElementById("grid-rows");
const gridVisible = document.getElementById("grid-visible");
const applyGridBtn = document.getElementById("apply-grid-btn");

const tokenName = document.getElementById("token-name");
const tokenColor = document.getElementById("token-color");
const tokenOwner = document.getElementById("token-owner");
const addTokenBtn = document.getElementById("add-token-btn");
const generatePlayerTokensBtn = document.getElementById("generate-player-tokens-btn");
const tokenList = document.getElementById("token-list");

/**
 * Keeps the grid input fields in sync with the latest server state, without
 * clobbering whatever the DM is actively typing.
 */
export function syncGridFormFromState() {
  if (document.activeElement && ["grid-cols", "grid-rows"].includes(document.activeElement.id)) return;
  gridCols.value = clientState.board.grid.cols;
  gridRows.value = clientState.board.grid.rows;
  gridVisible.checked = clientState.board.grid.visible;
}

/** The DM's token list (with per-token edit/remove controls) — a no-op for players. */
export function renderTokenList() {
  if (clientState.session.mode !== "dm") return;
  tokenList.innerHTML = "";
  Object.values(clientState.board.tokens).forEach((token) => {
    tokenList.appendChild(buildTokenListItem(token));
  });
}

/**
 * The Owner <select> in the Add Token form — repopulated whenever the
 * online-players list changes.
 */
export function renderOwnerDropdown() {
  const currentValue = tokenOwner.value;
  tokenOwner.innerHTML = '<option value="">None (DM-controlled)</option>';
  clientState.onlinePlayers.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.username;
    opt.textContent = p.characterName ? `${p.username} — ${p.characterName}` : p.username;
    tokenOwner.appendChild(opt);
  });
  // Preserve the DM's current selection if that player is still online.
  if (Array.from(tokenOwner.options).some((o) => o.value === currentValue)) {
    tokenOwner.value = currentValue;
  }
}

uploadForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!backgroundInput.files[0]) return;
  await ApiClient.uploadBackground(backgroundInput.files[0]);
});

applyGridBtn.addEventListener("click", () => {
  socketClient.emitEvent(EVENTS.SET_GRID, {
    cols: gridCols.value,
    rows: gridRows.value,
    visible: gridVisible.checked,
  });
});

addTokenBtn.addEventListener("click", () => {
  const name = tokenName.value.trim();
  if (!name) {
    alert("Give the token a name.");
    return;
  }
  socketClient.emitEvent(EVENTS.ADD_TOKEN, {
    name,
    color: tokenColor.value,
    owner: tokenOwner.value || null,
    col: Math.floor(clientState.board.grid.cols / 2),
    row: Math.floor(clientState.board.grid.rows / 2),
  });
  tokenName.value = "";
  tokenOwner.value = "";
});

generatePlayerTokensBtn.addEventListener("click", () => {
  // Generate a token for each online player who doesn't already have one. Use
  // the tokenColor from their character in the roster.
  clientState.onlinePlayers.forEach((p) => {
    if (!p.characterName) return; // skip players without a character
    const alreadyHasToken = Object.values(clientState.board.tokens).some((t) => t.owner === p.username);
    if (alreadyHasToken) return;

    const rosterEntry = clientState.dmRoster.find((r) => r.username === p.username);
    const color = rosterEntry ? rosterEntry.character.tokenColor : "#e63946";

    socketClient.emitEvent(EVENTS.ADD_TOKEN, {
      name: p.characterName,
      color,
      owner: p.username,
      col: Math.floor(clientState.board.grid.cols / 2),
      row: Math.floor(clientState.board.grid.rows / 2),
    });
  });
});
