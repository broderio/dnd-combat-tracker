// public/js/state.js
//
// Small central store for values shared across view modules. This is NOT a
// framework store (no subscriptions/reactivity) — just one place that owns
// these variables so different view modules don't each keep their own,
// possibly-stale copy.
//
// Browser note on `export let` / `export const { ... }`: ES modules export
// *live bindings*, not snapshots. That means if this file does
// `currentUsername = 'bob'` internally (via the setter functions below),
// every other file that did `import { currentUsername } from './state.js'`
// automatically sees the new value the next time it reads it — no need to
// re-import or pass values around by hand. `session` and `board` are plain
// objects, so their properties can just be mutated directly by anyone who
// imports them (no setter needed) — see gameShell.js / boardView.js for that.

import { defaultGrid, defaultTurnOrder } from "/shared/schema.js";

/** Who *this browser tab* is: `{ mode: 'dm'|'player'|null, name: string|null }`. */
export const session = { mode: null, name: null };

/** The shared board (background image, grid config, tokens, overlays, turn order) mirrored from the server's `state` event. */
export const board = { background: null, grid: defaultGrid(), tokens: {}, overlays: {}, turnOrder: defaultTurnOrder() };

/**
 * What the DM's pointer currently does when it interacts with the board,
 * beyond normal token dragging: `{ type: 'none' }`, `{ type: 'measure' }`, or
 * `{ type: 'place-overlay', draft: {...} }` (draft holds the in-progress
 * overlay's type/shape/radius/label, filled in by overlayPanelView before
 * the DM clicks a cell). boardView.js reads this to decide what a board
 * click/drag means; overlayPanelView.js and measureToolView.js are the only
 * modules that change it.
 */
export let boardTool = { type: "none" };

export let currentUsername = null; // set after successful login
export let currentCharacters = []; // this user's saved characters (from login / CRUD responses)
export let activeCharacter = null; // the character this player picked for this session
export let onlinePlayers = []; // [{username, characterName}] — public, no stats
export let dmRoster = []; // [{username, character}] — full stats, DM only

export function setBoardTool(tool) {
  boardTool = tool;
}

export function setCurrentUsername(username) {
  currentUsername = username;
}
export function setCurrentCharacters(characters) {
  currentCharacters = characters;
}
export function setActiveCharacter(character) {
  activeCharacter = character;
}
export function setOnlinePlayers(list) {
  onlinePlayers = list;
}
export function setDmRoster(roster) {
  dmRoster = roster;
}

export function setSession(mode, name) {
  session.mode = mode;
  session.name = name;
}

/** Replaces the board's contents in place (keeps the same object reference). */
export function setBoard(newBoard) {
  Object.assign(board, newBoard);
}
