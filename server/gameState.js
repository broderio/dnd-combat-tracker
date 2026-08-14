// server/gameState.js
//
// Owns the in-memory board state (background image, grid config, tokens,
// AoE overlays, turn-order tracker) for this single-table POC, plus the
// token/overlay id counters. Any code that needs to read or mutate the board
// goes through these functions instead of touching a shared `state` object
// directly — keeps server.js and the socket handlers from all reaching into
// the same mutable variable.
//
// Persistence: the board is loaded from data/db.json (via server/db.js) once
// at startup, and re-saved after every mutation, so the game can be resumed
// after a server restart (or at a later date) without losing the map, grid,
// tokens, overlays, or initiative order.

import {
  clampInt,
  defaultGrid,
  defaultTurnOrder,
  OVERLAY_TYPES,
  sanitizeGrid,
  sanitizeOverlay,
  sanitizeToken,
  sanitizeTurnOrder,
} from "../shared/schema.js";
import { loadBoardState, saveBoardState } from "./db.js";

const persisted = loadBoardState();

const state = {
  background: persisted?.background ?? null, // e.g. "/uploads/map.png"
  grid: persisted?.grid ?? defaultGrid(),
  tokens: persisted?.tokens ?? {},
  // tokens[id] = { id, name, color, col, row, owner, hp, statusEffects, overlayEffects }
  // owner === null means it's DM-controlled (monster/NPC), otherwise it's a
  // player username. statusEffects are DM-set conditions; overlayEffects are
  // computed automatically from AoE overlays (see recomputeOverlayEffects).
  overlays: persisted?.overlays ?? {},
  // overlays[id] = { id, type, shape, col, row, radius, label }
  turnOrder: persisted?.turnOrder ?? defaultTurnOrder(),
};

let nextTokenId = persisted?.nextTokenId ?? 1;
let nextOverlayId = persisted?.nextOverlayId ?? 1;

function persist() {
  saveBoardState({ ...state, nextTokenId, nextOverlayId });
}

/**
 * The full board state, as broadcast verbatim to clients over the `state`
 * event.
 */
export function getState() {
  return state;
}

export function setBackground(url) {
  state.background = url;
  persist();
}

export function setGrid(input) {
  state.grid = sanitizeGrid(input, state.grid);
  persist();
  return state.grid;
}

export function addToken(input) {
  const id = "tok_" + nextTokenId++;
  const token = { id, ...sanitizeToken(input, state.grid) };
  state.tokens[id] = token;
  recomputeOverlayEffects(token);
  persist();
  return token;
}

export function removeToken(id) {
  delete state.tokens[id];
  removeFromTurnOrder(id);
  persist();
}

export function getToken(id) {
  return state.tokens[id];
}

/**
 * DM-only partial token edit — HP and/or status effects (see
 * server/socketHandlers/tokenHandlers.js's UPDATE_TOKEN handler). Reuses
 * `sanitizeToken`'s partial-update mode (same pattern as `sanitizeCharacter`).
 */
export function updateToken(id, input) {
  const existing = state.tokens[id];
  if (!existing) return null;
  const updated = sanitizeToken(input, state.grid, existing);
  state.tokens[id] = updated;
  recomputeOverlayEffects(updated);
  persist();
  return updated;
}

/**
 * Moves a token, clamping to the current grid bounds. If the destination
 * cell is already occupied by a different token, snaps to the nearest free
 * cell instead of overlapping (see findNearestFreeCell). Returns the updated
 * token, or null if it doesn't exist.
 */
export function moveToken(id, col, row) {
  const token = state.tokens[id];
  if (!token) return null;

  let targetCol = clampInt(col, 0, Math.max(0, state.grid.cols - 1), token.col);
  let targetRow = clampInt(row, 0, Math.max(0, state.grid.rows - 1), token.row);

  if (isOccupied(targetCol, targetRow, id)) {
    const free = findNearestFreeCell(targetCol, targetRow, id);
    if (free) {
      targetCol = free.col;
      targetRow = free.row;
    } else {
      // Board is completely full — stay put rather than overlap.
      targetCol = token.col;
      targetRow = token.row;
    }
  }

  token.col = targetCol;
  token.row = targetRow;
  recomputeOverlayEffects(token);
  persist();
  return token;
}

function isOccupied(col, row, excludeTokenId) {
  return Object.values(state.tokens).some((t) => t.id !== excludeTokenId && t.col === col && t.row === row);
}

/**
 * Expanding-ring search outward from (col, row), returning the closest
 * (Euclidean distance) unoccupied in-bounds cell, or null if the whole board
 * is full. Ring `radius` r checks the square perimeter at Chebyshev distance
 * r, so smaller radii (already-checked ones) aren't re-scanned.
 */
function findNearestFreeCell(col, row, excludeTokenId) {
  const maxRadius = Math.max(state.grid.cols, state.grid.rows);
  for (let radius = 1; radius <= maxRadius; radius++) {
    let best = null;
    let bestDist = Infinity;
    for (let dc = -radius; dc <= radius; dc++) {
      for (let dr = -radius; dr <= radius; dr++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== radius) continue; // outer ring only
        const c = col + dc;
        const r = row + dr;
        if (c < 0 || r < 0 || c >= state.grid.cols || r >= state.grid.rows) continue;
        if (isOccupied(c, r, excludeTokenId)) continue;
        const dist = dc * dc + dr * dr;
        if (dist < bestDist) {
          bestDist = dist;
          best = { col: c, row: r };
        }
      }
    }
    if (best) return best;
  }
  return null;
}

// ---------------- Overlays (area-of-effect) ----------------

export function addOverlay(input) {
  const id = "ovl_" + nextOverlayId++;
  const overlay = { id, ...sanitizeOverlay(input, state.grid) };
  state.overlays[id] = overlay;
  recomputeOverlayEffects();
  persist();
  return overlay;
}

export function removeOverlay(id) {
  delete state.overlays[id];
  recomputeOverlayEffects();
  persist();
}

/**
 * Recomputes `overlayEffects` (the automatic, overlay-derived status tags)
 * for one token (after it moves/is edited) or every token (after an overlay
 * is added/removed, since that can change which tokens are inside/outside
 * any overlay). Kept entirely separate from `statusEffects` (the DM's manual
 * edits) so the two never clobber each other.
 */
function recomputeOverlayEffects(singleToken) {
  const tokens = singleToken ? [singleToken] : Object.values(state.tokens);
  for (const token of tokens) {
    const tags = new Set();
    for (const overlay of Object.values(state.overlays)) {
      if (isTokenInsideOverlay(token, overlay)) {
        const effectTag = OVERLAY_TYPES[overlay.type]?.effectTag;
        if (effectTag) tags.add(effectTag);
      }
    }
    token.overlayEffects = Array.from(tags);
  }
}

function isTokenInsideOverlay(token, overlay) {
  const dc = token.col - overlay.col;
  const dr = token.row - overlay.row;
  if (overlay.shape === "square") {
    return Math.abs(dc) <= overlay.radius && Math.abs(dr) <= overlay.radius;
  }
  return dc * dc + dr * dr <= overlay.radius * overlay.radius; // circle
}

// ---------------- Turn order / initiative ----------------

export function setTurnOrder(combatants) {
  state.turnOrder = sanitizeTurnOrder(combatants, state.tokens);
  persist();
  return state.turnOrder;
}

/** Advances to the next combatant, wrapping around and incrementing `round`. */
export function nextTurn() {
  const order = state.turnOrder;
  if (order.combatants.length === 0) return order;
  order.currentIndex += 1;
  if (order.currentIndex >= order.combatants.length) {
    order.currentIndex = 0;
    order.round += 1;
  }
  persist();
  return order;
}

function removeFromTurnOrder(tokenId) {
  const order = state.turnOrder;
  const idx = order.combatants.findIndex((c) => c.tokenId === tokenId);
  if (idx === -1) return;
  order.combatants.splice(idx, 1);
  if (order.combatants.length === 0) {
    order.currentIndex = -1;
    order.round = 0;
  } else if (order.currentIndex >= order.combatants.length) {
    order.currentIndex = 0;
  }
}
