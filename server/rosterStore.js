// server/rosterStore.js
//
// Owns `activePlayers`: everyone currently connected as a player (socket.id ->
// { username, character }). Both the REST character routes and the socket
// handlers need to read/mutate this and trigger the two broadcasts below, so
// it lives in its own module rather than as a variable server.js used to own.

import { EVENTS } from "../shared/protocol.js";

/** @type {Map<string, { username: string, character: object|null }>} */
const activePlayers = new Map();

export function addActivePlayer(socketId, username, character) {
  activePlayers.set(socketId, { username, character: character || null });
}

export function removeActivePlayer(socketId) {
  activePlayers.delete(socketId);
}

export function getActivePlayers() {
  return activePlayers;
}

/**
 * If the given username is currently connected and playing the given
 * character, update the in-memory copy so future broadcasts see it.
 * Returns the list of socket ids that were updated (usually 0 or 1).
 */
export function updateActiveCharacterIfMatches(username, characterId, character) {
  const updatedSocketIds = [];
  for (const [socketId, entry] of activePlayers.entries()) {
    if (
      entry.username.toLowerCase() === username.toLowerCase() &&
      entry.character &&
      entry.character.id === characterId
    ) {
      entry.character = character;
      updatedSocketIds.push(socketId);
    }
  }
  return updatedSocketIds;
}

// Public-safe list: username + character name only. No stats. Sent to everyone
// (used for the token-owner dropdown, which any DM can open, and is harmless
// for players to see too).
export function broadcastOnlinePlayers(io) {
  const list = Array.from(activePlayers.values()).map((entry) => ({
    username: entry.username,
    characterName: entry.character ? entry.character.name : null,
  }));
  io.emit(EVENTS.PLAYERS_ONLINE, list);
}

// Full stats for everyone currently online, sent ONLY to DM sockets.
export function pushAllCharactersToDMs(io) {
  const list = Array.from(activePlayers.values())
    .filter((entry) => entry.character)
    .map((entry) => ({ username: entry.username, character: entry.character }));

  for (const [, s] of io.sockets.sockets) {
    if (s.data.session && s.data.session.mode === "dm") {
      s.emit(EVENTS.ALL_CHARACTERS, list);
    }
  }
}

/**
 * If the player this character belongs to is currently connected, push the
 * update to their own socket (so their sidebar refreshes) and to every DM
 * socket (so the DM's roster refreshes). Called after any REST edit to a
 * character.
 */
export function notifyCharacterUpdated(io, username, characterId, character) {
  const updatedSocketIds = updateActiveCharacterIfMatches(username, characterId, character);
  for (const socketId of updatedSocketIds) {
    io.to(socketId).emit(EVENTS.YOUR_CHARACTER, character);
  }
  pushAllCharactersToDMs(io);
}
