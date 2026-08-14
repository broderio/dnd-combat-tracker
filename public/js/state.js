// public/js/state.js
//
// Small central store for values shared across view modules, as a
// `ClientState` class (see the `clientState` singleton at the bottom) —
// one place that owns these fields so different view modules don't each
// keep their own, possibly-stale copy.
//
// This is NOT a framework store (no subscriptions/reactivity) — view
// modules read `clientState.session`/`clientState.board`/etc. directly and
// re-render when a relevant socket event tells them to. `session` and
// `board` are plain objects, so their nested properties can be mutated
// directly by anyone holding a reference (see boardView.js) — the setter
// methods below exist for the fields that get wholesale-replaced.

import { Grid, TurnOrder } from "/shared/schema.js";

export class ClientState {
  constructor() {
    /** Who *this browser tab* is: `{ mode: 'dm'|'player'|null, name: string|null }`. */
    this.session = { mode: null, name: null };

    /** The shared board (background image, grid config, tokens, overlays, turn order) mirrored from the server's `state` event. */
    this.board = {
      background: null,
      grid: Grid.default(),
      tokens: {},
      overlays: {},
      turnOrder: TurnOrder.default(),
      // combatantStatuses[combatantId] = { combatantId, condition, statusEffects }
      // — the redacted, no-numbers view every client (not just the owner/DM)
      // receives for each linked token, used to render bloodied glow/status
      // icons. See ARCHITECTURE.md's "Single source of truth" section.
      combatantStatuses: {},
    };

    /**
     * What the DM's pointer currently does when it interacts with the board,
     * beyond normal token dragging: `{ type: 'none' }`, `{ type: 'measure' }`,
     * or `{ type: 'place-overlay', draft: {...} }` (draft holds the
     * in-progress overlay's type/shape/radius/label, filled in by
     * OverlayPanelView before the DM clicks a cell). BoardView reads this to
     * decide what a board click/drag means; OverlayPanelView and
     * MeasureToolView are the only classes that change it.
     */
    this.boardTool = { type: "none" };

    this.currentUsername = null; // set after successful login
    this.currentCharacters = []; // this user's saved characters (from login / CRUD responses)
    this.activeCharacter = null; // the character this player picked for this session
    this.onlinePlayers = []; // [{username, characterName}] — public, no stats
    this.dmRoster = []; // [{username, character}] — full stats, DM only
    this.dmMonsterInstances = {}; // {id: MonsterInstance.toJSON()} — full stats, DM only
  }

  setBoardTool(tool) {
    this.boardTool = tool;
  }

  setCurrentUsername(username) {
    this.currentUsername = username;
  }
  setCurrentCharacters(characters) {
    this.currentCharacters = characters;
  }
  setActiveCharacter(character) {
    this.activeCharacter = character;
  }
  setOnlinePlayers(list) {
    this.onlinePlayers = list;
  }
  setDmRoster(roster) {
    this.dmRoster = roster;
  }
  setDmMonsterInstances(instances) {
    this.dmMonsterInstances = instances;
  }

  setSession(mode, name) {
    this.session.mode = mode;
    this.session.name = name;
  }

  /** Replaces the board's contents in place (keeps the same object reference). */
  setBoard(newBoard) {
    Object.assign(this.board, newBoard);
  }
}

export const clientState = new ClientState();

