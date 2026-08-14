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
 * @property {string[]} overlayEffects - recomputed for the moved token, since
 *   moving can enter/leave an AoE overlay
 *
 * @typedef {Object} UpdateTokenPayload - DM-only partial token edit
 * @property {string} id
 * @property {{current?: number, max?: number}} [hp]
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
 */

export const EVENTS = {
  // client -> server
  JOIN: "join",
  SET_GRID: "set-grid",
  ADD_TOKEN: "add-token",
  REMOVE_TOKEN: "remove-token",
  MOVE_TOKEN: "move-token",
  UPDATE_TOKEN: "update-token",
  ADD_OVERLAY: "add-overlay",
  REMOVE_OVERLAY: "remove-overlay",
  SET_TURN_ORDER: "set-turn-order",
  NEXT_TURN: "next-turn",

  // server -> client
  JOINED: "joined",
  STATE: "state",
  PRESENCE: "presence",
  YOUR_CHARACTER: "your-character",
  ALL_CHARACTERS: "all-characters",
  PLAYERS_ONLINE: "players-online",
  TOKEN_MOVED: "token-moved",
};
