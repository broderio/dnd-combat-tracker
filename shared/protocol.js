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

  // server -> client
  JOINED: "joined",
  STATE: "state",
  PRESENCE: "presence",
  YOUR_CHARACTER: "your-character",
  ALL_CHARACTERS: "all-characters",
  PLAYERS_ONLINE: "players-online",
  TOKEN_MOVED: "token-moved",
};
