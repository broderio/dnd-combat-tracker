// server/gameState.js
//
// Owns the in-memory board state (background image, grid config, tokens) for
// this single-table POC, plus the token-id counter. Any code that needs to
// read or mutate the board goes through these functions instead of touching
// a shared `state` object directly — keeps server.js and the socket handlers
// from all reaching into the same mutable variable.

import { clampInt, defaultGrid, sanitizeGrid, sanitizeToken } from "../shared/schema.js";

const state = {
  background: null, // e.g. "/uploads/map.png"
  grid: defaultGrid(),
  tokens: {},
  // tokens[id] = { id, name, color, col, row, owner }
  // owner === null means it's DM-controlled (monster/NPC), otherwise it's a
  // player username
};

let nextTokenId = 1;

/**
 * The full board state, as broadcast verbatim to clients over the `state`
 * event.
 */
export function getState() {
  return state;
}

export function setBackground(url) {
  state.background = url;
}

export function setGrid(input) {
  state.grid = sanitizeGrid(input, state.grid);
  return state.grid;
}

export function addToken(input) {
  const id = "tok_" + nextTokenId++;
  const token = { id, ...sanitizeToken(input, state.grid) };
  state.tokens[id] = token;
  return token;
}

export function removeToken(id) {
  delete state.tokens[id];
}

export function getToken(id) {
  return state.tokens[id];
}

/**
 * Moves a token, clamping to the current grid bounds. Returns the updated
 * token, or null if it doesn't exist.
 */
export function moveToken(id, col, row) {
  const token = state.tokens[id];
  if (!token) return null;
  token.col = clampInt(col, 0, state.grid.cols - 1, token.col);
  token.row = clampInt(row, 0, state.grid.rows - 1, token.row);
  return token;
}
