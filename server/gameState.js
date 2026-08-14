// server/gameState.js
//
// Owns the in-memory board state (background image, grid config, tokens,
// AoE overlays, turn-order tracker) for this single-table POC, plus the
// token/overlay id counters. Any code that needs to read or mutate the board
// goes through the `gameState` singleton (a `GameStateStore` instance)
// instead of touching a shared `state` object directly — keeps server.js and
// the socket handlers from all reaching into the same mutable variable.
//
// Persistence: the board is loaded from data/db.json (via the `db` instance
// in server/db.js) once at construction, and re-saved after every mutation,
// so the game can be resumed after a server restart (or at a later date)
// without losing the map, grid, tokens, overlays, or initiative order.

import { Grid, Overlay, Token, TurnOrder, Validators } from "../shared/schema.js";
import { db } from "./db.js";

export class GameStateStore {
  constructor(database) {
    this.db = database;
    const persisted = this.db.loadBoardState();

    this.background = persisted?.background ?? null; // e.g. "/uploads/map.png"
    this.grid = persisted?.grid ? Object.assign(new Grid(), persisted.grid) : Grid.default();

    // tokens[id] = Token — owner === null means it's DM-controlled
    // (monster/NPC), otherwise it's a player username. statusEffects are
    // DM-set conditions; overlayEffects are computed automatically from AoE
    // overlays (see #recomputeAllOverlayEffects).
    this.tokens = {};
    for (const [id, t] of Object.entries(persisted?.tokens ?? {})) {
      this.tokens[id] = Token.clone(t);
    }

    // overlays[id] = Overlay
    this.overlays = {};
    for (const [id, o] of Object.entries(persisted?.overlays ?? {})) {
      this.overlays[id] = Object.assign(new Overlay(), o);
    }

    this.turnOrder = persisted?.turnOrder ? Object.assign(new TurnOrder(), persisted.turnOrder) : TurnOrder.default();

    this.nextTokenId = persisted?.nextTokenId ?? 1;
    this.nextOverlayId = persisted?.nextOverlayId ?? 1;
  }

  #persist() {
    this.db.saveBoardState({
      background: this.background,
      grid: this.grid.toJSON(),
      tokens: Object.fromEntries(Object.entries(this.tokens).map(([id, t]) => [id, t.toJSON()])),
      overlays: Object.fromEntries(Object.entries(this.overlays).map(([id, o]) => [id, o.toJSON()])),
      turnOrder: this.turnOrder.toJSON(),
      nextTokenId: this.nextTokenId,
      nextOverlayId: this.nextOverlayId,
    });
  }

  /**
   * The full board state, as broadcast verbatim to clients over the `state`
   * event.
   */
  getState() {
    return {
      background: this.background,
      grid: this.grid.toJSON(),
      tokens: Object.fromEntries(Object.entries(this.tokens).map(([id, t]) => [id, t.toJSON()])),
      overlays: Object.fromEntries(Object.entries(this.overlays).map(([id, o]) => [id, o.toJSON()])),
      turnOrder: this.turnOrder.toJSON(),
    };
  }

  setBackground(url) {
    this.background = url;
    this.#persist();
  }

  setGrid(input) {
    this.grid = Grid.fromInput(input, this.grid);
    this.#persist();
    return this.grid;
  }

  addToken(input) {
    const id = "tok_" + this.nextTokenId++;
    const token = Token.fromInput(input, this.grid);
    token.id = id;
    this.tokens[id] = token;
    token.recomputeOverlayEffects(Object.values(this.overlays));
    this.#persist();
    return token;
  }

  removeToken(id) {
    delete this.tokens[id];
    this.turnOrder.removeCombatant(id);
    this.#persist();
  }

  getToken(id) {
    return this.tokens[id];
  }

  /**
   * DM-only partial token edit — HP and/or status effects (see
   * server/socketHandlers/tokenHandlers.js's UPDATE_TOKEN handler). Reuses
   * `Token.fromInput`'s partial-update mode (same pattern as
   * `Character.fromInput`).
   */
  updateToken(id, input) {
    const existing = this.tokens[id];
    if (!existing) return null;
    const updated = Token.fromInput(input, this.grid, existing);
    this.tokens[id] = updated;
    updated.recomputeOverlayEffects(Object.values(this.overlays));
    this.#persist();
    return updated;
  }

  /**
   * Moves a token, clamping to the current grid bounds. If the destination
   * cell is already occupied by a different token, snaps to the nearest free
   * cell instead of overlapping (see #findNearestFreeCell). Returns the
   * updated token, or null if it doesn't exist.
   */
  moveToken(id, col, row) {
    const token = this.tokens[id];
    if (!token) return null;

    let targetCol = Validators.clampInt(col, 0, Math.max(0, this.grid.cols - 1), token.col);
    let targetRow = Validators.clampInt(row, 0, Math.max(0, this.grid.rows - 1), token.row);

    if (this.#isOccupied(targetCol, targetRow, id)) {
      const free = this.#findNearestFreeCell(targetCol, targetRow, id);
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
    token.recomputeOverlayEffects(Object.values(this.overlays));
    this.#persist();
    return token;
  }

  #isOccupied(col, row, excludeTokenId) {
    return Object.values(this.tokens).some((t) => t.id !== excludeTokenId && t.col === col && t.row === row);
  }

  /**
   * Expanding-ring search outward from (col, row), returning the closest
   * (Euclidean distance) unoccupied in-bounds cell, or null if the whole
   * board is full. Ring `radius` r checks the square perimeter at Chebyshev
   * distance r, so smaller radii (already-checked ones) aren't re-scanned.
   */
  #findNearestFreeCell(col, row, excludeTokenId) {
    const maxRadius = Math.max(this.grid.cols, this.grid.rows);
    for (let radius = 1; radius <= maxRadius; radius++) {
      let best = null;
      let bestDist = Infinity;
      for (let dc = -radius; dc <= radius; dc++) {
        for (let dr = -radius; dr <= radius; dr++) {
          if (Math.max(Math.abs(dc), Math.abs(dr)) !== radius) continue; // outer ring only
          const c = col + dc;
          const r = row + dr;
          if (c < 0 || r < 0 || c >= this.grid.cols || r >= this.grid.rows) continue;
          if (this.#isOccupied(c, r, excludeTokenId)) continue;
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

  addOverlay(input) {
    const id = "ovl_" + this.nextOverlayId++;
    const overlay = Overlay.fromInput(input, this.grid);
    overlay.id = id;
    this.overlays[id] = overlay;
    this.#recomputeAllOverlayEffects();
    this.#persist();
    return overlay;
  }

  removeOverlay(id) {
    delete this.overlays[id];
    this.#recomputeAllOverlayEffects();
    this.#persist();
  }

  #recomputeAllOverlayEffects() {
    const overlays = Object.values(this.overlays);
    for (const token of Object.values(this.tokens)) {
      token.recomputeOverlayEffects(overlays);
    }
  }

  // ---------------- Turn order / initiative ----------------

  setTurnOrder(combatants) {
    this.turnOrder = TurnOrder.fromEntries(combatants, this.tokens);
    this.#persist();
    return this.turnOrder;
  }

  /** Advances to the next combatant, wrapping around and incrementing `round`. */
  nextTurn() {
    this.turnOrder.advance();
    this.#persist();
    return this.turnOrder;
  }
}

export const gameState = new GameStateStore(db);

