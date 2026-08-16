// shared/protocol.js
//
// Single source of truth for Socket.io event names and payload shapes.
// Both server.js and public/js code import EVENTS from this file instead of
// typing event-name strings by hand — a typo in an event name now becomes an
// "EVENTS.TYPO is undefined" error instead of a silently-never-fires bug.
//
// Loaded the same way as shared/schema.js (see the comment at the top of that
// file for how the no-build-step sharing works).

/**
 * @typedef {Object} JoinPayload
 * @property {'dm'|'player'} mode
 * @property {string} name
 * @property {string} [characterId] - required when mode === 'player'
 *
 * @typedef {Object} JoinedPayload
 * @property {'dm'|'player'} mode
 * @property {string} name
 *
 * @typedef {Object} PresencePayload
 * @property {string} message
 *
 * @typedef {Object} MoveTokenPayload
 * @property {string} id
 * @property {number} col
 * @property {number} row
 *
 * @typedef {Object} TokenMovedPayload
 * @property {string} id
 * @property {number} col
 * @property {number} row
 *
 * @typedef {Object} AddTokenPayload
 * @property {string} name
 * @property {string} color
 * @property {string|null} owner
 * @property {number} col
 * @property {number} row
 * @property {string|null} [combatantId] - links this token to a Character
 *   (or, from Phase 2, monster instance); HP/status are never sent here —
 *   they live only on the source record (see CombatantStatus below)
 *
 * @typedef {Object} CombatantStatus - the redacted, no-numbers public view
 *   of a linked combatant, broadcast to everyone as part of `state`
 * @property {string} combatantId
 * @property {'healthy'|'hurt'|'critical'|'dead'} condition
 * @property {string[]} statusEffects
 *
 * @typedef {Object} AddMonsterTokenPayload - places a monster from the
 * @property {string} templateId - a MonsterTemplate id (see server/monsterLibrary.js), e.g. "mon_42"
 * @property {string} color
 * @property {number} col
 * @property {number} row
 *
 * @typedef {Object} UpdateMonsterInstancePayload - DM-only quick-edit of a
 *   placed monster instance's hp/statusEffects (its only mutable fields)
 * @property {string} id - a MonsterInstance id, e.g. "moninst_3"
 * @property {{current: number, max: number}} [hp]
 * @property {string[]} [statusEffects]
 *
 * @typedef {Object} AddOverlayPayload
 * @property {keyof import('./schema.js').OVERLAY_TYPES} type
 * @property {'circle'|'square'} shape
 * @property {number} col
 * @property {number} row
 * @property {number} radius
 * @property {string} [label]
 *
 * @typedef {Object} SetTurnOrderPayload
 * @property {{tokenId: string, initiative: number}[]} combatants
 *
 * @typedef {Object} OnlinePlayerSummary
 * @property {string} username
 * @property {string|null} characterName
 *
 * @typedef {Object} DMRosterEntry
 * @property {string} username
 * @property {import('./schema.js').Character} character
 *
 * @typedef {Object} RollDicePayload - client -> server dice roll request
 * @property {number} count - number of dice, 1-20
 * @property {number} sides - sides per die, 2-100
 * @property {number} modifier - flat modifier added to the total, -100..100
 *
 * @typedef {Object} DiceRolledPayload - server -> everyone, broadcast so all
 *   players/the DM can see every roll (the standard "public dice log" UX)
 * @property {string} username
 * @property {'dm'|'player'} mode
 * @property {number} count
 * @property {number} sides
 * @property {number} modifier
 * @property {number[]} rolls - each individual die result
 * @property {number} total - sum of `rolls` plus `modifier`
 */
export const EVENTS = {
  // client -> server
  JOIN: 'join',
  SET_GRID: 'set-grid',
  ADD_TOKEN: 'add-token',
  REMOVE_TOKEN: 'remove-token',
  MOVE_TOKEN: 'move-token',
  ADD_MONSTER_TOKEN: 'add-monster-token',
  UPDATE_MONSTER_INSTANCE: 'update-monster-instance',
  ADD_OVERLAY: 'add-overlay',
  REMOVE_OVERLAY: 'remove-overlay',
  SET_TURN_ORDER: 'set-turn-order',
  NEXT_TURN: 'next-turn',
  ROLL_DICE: 'roll-dice',

  // server -> client
  JOINED: 'joined',
  STATE: 'state',
  PRESENCE: 'presence',
  YOUR_CHARACTER: 'your-character',
  ALL_CHARACTERS: 'all-characters',
  PLAYERS_ONLINE: 'players-online',
  TOKEN_MOVED: 'token-moved',
  // Full (real hp/statusEffects) monster instance data — DM-only, mirrors
  // ALL_CHARACTERS. The general `state` broadcast only carries the redacted
  // combatantStatuses view (see MonsterInstance in shared/schema.js).
  ALL_MONSTER_INSTANCES: 'all-monster-instances',
  DICE_ROLLED: 'dice-rolled',
};
