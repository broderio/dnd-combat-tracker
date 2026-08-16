import { EVENTS } from '../shared/protocol.js';

export class RosterStore {
  constructor() {
    /** @type {Map<string, { username: string, character: object|null }>} */
    this.activePlayers = new Map();
  }

  addActivePlayer(socketId, username, character) {
    this.activePlayers.set(socketId, { username, character: character || null });
  }

  removeActivePlayer(socketId) {
    this.activePlayers.delete(socketId);
  }

  getActivePlayers() {
    return this.activePlayers;
  }

  /**
   * If the given username is currently connected and playing the given
   * character, update the in-memory copy so future broadcasts see it.
   * Returns the list of socket ids that were updated (usually 0 or 1).
   */
  updateActiveCharacterIfMatches(username, characterId, character) {
    const updatedSocketIds = [];
    for (const [socketId, entry] of this.activePlayers.entries()) {
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

  // Public-safe list: username + character name only. No stats. Sent to
  // everyone (used for the token-owner dropdown, which any DM can open, and
  // is harmless for players to see too).
  broadcastOnlinePlayers(io) {
    const list = Array.from(this.activePlayers.values()).map((entry) => ({
      username: entry.username,
      characterName: entry.character ? entry.character.name : null,
    }));
    io.emit(EVENTS.PLAYERS_ONLINE, list);
  }

  // Full stats for everyone currently online, sent ONLY to DM sockets.
  pushAllCharactersToDMs(io) {
    const list = Array.from(this.activePlayers.values())
      .filter((entry) => entry.character)
      .map((entry) => ({ username: entry.username, character: entry.character }));

    for (const [, s] of io.sockets.sockets) {
      if (s.data.session && s.data.session.mode === 'dm') {
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
  notifyCharacterUpdated(io, username, characterId, character) {
    const updatedSocketIds = this.updateActiveCharacterIfMatches(username, characterId, character);
    for (const socketId of updatedSocketIds) {
      io.to(socketId).emit(EVENTS.YOUR_CHARACTER, character);
    }
    this.pushAllCharactersToDMs(io);
  }
}

export const rosterStore = new RosterStore();
