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

import { computeCondition, Grid, MonsterInstance, Overlay, Token, TurnOrder, Validators } from "../shared/schema.js";
import { EVENTS } from "../shared/protocol.js";
import { db } from "./db.js";
import { monsterLibrary } from "./monsterLibrary.js";

export class GameStateStore {
  constructor(database) {
    this.db = database;
    this.#loadFromSnapshot(this.db.loadBoardState());
  }

  /**
   * Populates every piece of board state from a persisted/saved-encounter
   * snapshot (same shape either way — see `toSnapshotJSON`), falling back to
   * schema defaults for anything missing. Shared by the constructor (loading
   * from data/db.json) and `restoreSnapshot` (loading a saved encounter) so
   * there's exactly one place that knows how to turn a snapshot object back
   * into live state.
   */
  #loadFromSnapshot(persisted) {
    this.background = persisted?.background ?? null; // e.g. "/uploads/map.png"
    this.grid = persisted?.grid ? Object.assign(new Grid(), persisted.grid) : Grid.default();

    // tokens[id] = Token — owner === null means it's DM-controlled
    // (monster/NPC), otherwise it's a player username. statusEffects are
    // DM-set conditions on the linked combatant, not the token itself.
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

    // monsterInstances[id] = MonsterInstance — placed from the read-only
    // dnd-data library (see server/monsterLibrary.js). Instance HP/status is
    // combat-mutable board state, so it's persisted here, alongside tokens,
    // rather than in data/db.json's user/character records.
    this.monsterInstances = {};
    for (const [id, m] of Object.entries(persisted?.monsterInstances ?? {})) {
      this.monsterInstances[id] = MonsterInstance.clone(m);
    }

    this.nextTokenId = persisted?.nextTokenId ?? 1;
    this.nextOverlayId = persisted?.nextOverlayId ?? 1;
    this.nextMonsterInstanceId = persisted?.nextMonsterInstanceId ?? 1;
  }

  #persist() {
    this.db.saveBoardState(this.toSnapshotJSON());
  }

  /**
   * The exact shape persisted to data/db.json's `board` key, and also what a
   * saved Encounter's `snapshot` is (see shared/schema.js's `Encounter` and
   * server/routes/encounters.js) — everything needed to fully reconstruct
   * this store's state later via `#loadFromSnapshot`/`restoreSnapshot`.
   */
  toSnapshotJSON() {
    return {
      background: this.background,
      grid: this.grid.toJSON(),
      tokens: Object.fromEntries(Object.entries(this.tokens).map(([id, t]) => [id, t.toJSON()])),
      overlays: Object.fromEntries(Object.entries(this.overlays).map(([id, o]) => [id, o.toJSON()])),
      turnOrder: this.turnOrder.toJSON(),
      nextTokenId: this.nextTokenId,
      nextOverlayId: this.nextOverlayId,
      monsterInstances: Object.fromEntries(Object.entries(this.monsterInstances).map(([id, m]) => [id, m.toJSON()])),
      nextMonsterInstanceId: this.nextMonsterInstanceId,
    };
  }

  /**
   * Replaces the ENTIRE board (background, grid, tokens + positions,
   * overlays, turn order, monster instances, id counters) with a saved
   * encounter's snapshot and persists it — used by `POST
   * /api/encounters/:id/load` (Phase 3). Whatever was on the board before
   * this call is gone, same as loading a save file.
   */
  restoreSnapshot(snapshot) {
    this.#loadFromSnapshot(snapshot);
    this.#persist();
  }

  /**
   * The full board state, as broadcast verbatim to clients over the `state`
   * event. `combatantStatuses` is the redacted, no-numbers public view of
   * every linked combatant currently placed as a token (see
   * #computeCombatantStatuses) — this is what lets every player render a
   * token's bloodied glow/status icons (their own, another player's, or a
   * monster's) without receiving anyone else's real HP number over the wire.
   * Full private stats still only go out via `your-character` (owner) and
   * `all-characters` (DM). Full MonsterInstance hp/statusEffects are
   * likewise deliberately NOT included here — see `getMonsterInstancesJSON`/
   * `pushMonsterInstancesToDMs`, DM-only, same privacy boundary as Character.
   */
  getState() {
    return {
      background: this.background,
      grid: this.grid.toJSON(),
      tokens: Object.fromEntries(Object.entries(this.tokens).map(([id, t]) => [id, t.toJSON()])),
      overlays: Object.fromEntries(Object.entries(this.overlays).map(([id, o]) => [id, o.toJSON()])),
      turnOrder: this.turnOrder.toJSON(),
      combatantStatuses: this.#computeCombatantStatuses(),
    };
  }

  /** Full monster instance stats (real hp/statusEffects) — DM-only, see JoinHandler/TokenHandlers. */
  getMonsterInstancesJSON() {
    return Object.fromEntries(Object.entries(this.monsterInstances).map(([id, m]) => [id, m.toJSON()]));
  }

  /** Pushes the full monster instance list to every currently-connected DM socket. */
  pushMonsterInstancesToDMs(io) {
    const list = this.getMonsterInstancesJSON();
    for (const [, s] of io.sockets.sockets) {
      if (s.data.session && s.data.session.mode === "dm") {
        s.emit(EVENTS.ALL_MONSTER_INSTANCES, list);
      }
    }
  }

  /**
   * Recomputed fresh on every `getState()` call (cheap at this app's scale)
   * rather than cached, so it's always consistent with whatever the source
   * record currently says — no separate invalidation path to get wrong.
   * Looks a linked token's `combatantId` up in whichever store its
   * `combatantType` says (a Character via db.findCharacter, or a
   * MonsterInstance via this.monsterInstances) — one redaction choke point
   * for both combatant kinds, per the single-source-of-truth design.
   */
  #computeCombatantStatuses() {
    const statuses = {};
    for (const token of Object.values(this.tokens)) {
      if (!token.combatantId || statuses[token.combatantId]) continue;
      let hp, statusEffects;
      if (token.combatantType === "monster") {
        const monster = this.monsterInstances[token.combatantId];
        if (!monster) continue;
        hp = monster.hp;
        statusEffects = monster.statusEffects;
      } else {
        const character = this.db.findCharacter(token.owner, token.combatantId);
        if (!character) continue;
        hp = character.hp;
        statusEffects = character.statusEffects;
      }
      statuses[token.combatantId] = {
        combatantId: token.combatantId,
        condition: computeCondition(hp),
        statusEffects: statusEffects || [],
      };
    }
    return statuses;
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
    this.#persist();
    return token;
  }

  removeToken(id) {
    const token = this.tokens[id];
    delete this.tokens[id];
    this.turnOrder.removeCombatant(id);
    // A monster instance only exists to back one placed token — unlike a
    // Character (which persists independently in data/db.json across
    // placements/sessions), so remove it too rather than leaking orphans.
    if (token?.combatantType === "monster" && token.combatantId) {
      delete this.monsterInstances[token.combatantId];
    }
    this.#persist();
  }

  getToken(id) {
    return this.tokens[id];
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
    this.#persist();
    return token;
  }

  #isOccupied(col, row, excludeTokenId) {
    return Object.values(this.tokens).some((t) => t.id !== excludeTokenId && t.col === col && t.row === row);
  }

  // ---------------- Monster instances (Phase 2 monster library) ----------------

  /**
   * Creates a fresh MonsterInstance from a `dnd-data` template (full HP,
   * no status effects) and persists it — does NOT place a token; callers
   * (see socketHandlers/monsterHandlers.js) create the instance and its
   * token together in one request so a monster is never "in the library
   * but not on the board" state that could confuse `combatantStatuses`.
   */
  addMonsterInstance(templateId) {
    const template = monsterLibrary.getTemplate(templateId);
    if (!template) return null;
    const id = "moninst_" + this.nextMonsterInstanceId++;
    const instance = MonsterInstance.fromTemplate(template);
    instance.id = id;
    this.monsterInstances[id] = instance;
    this.#persist();
    return instance;
  }

  getMonsterInstance(id) {
    return this.monsterInstances[id];
  }

  /** Partial hp/statusEffects update — the DM sidebar's only two monster-instance controls. */
  updateMonsterInstance(id, input) {
    const existing = this.monsterInstances[id];
    if (!existing) return null;
    const updated = MonsterInstance.fromInput(input, existing);
    updated.id = id;
    this.monsterInstances[id] = updated;
    this.#persist();
    return updated;
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
    this.#persist();
    return overlay;
  }

  removeOverlay(id) {
    delete this.overlays[id];
    this.#persist();
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

