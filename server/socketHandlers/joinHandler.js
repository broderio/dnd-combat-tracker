// server/socketHandlers/joinHandler.js
//
// Handles the 'join' event (initial join AND client-driven reconnect rejoin)
// and 'disconnect'. Populates `session` (shared with the other handler
// modules for this socket) and keeps the roster/presence broadcasts in sync.

import { EVENTS } from "../../shared/protocol.js";
import { loadDB } from "../db.js";
import { getState } from "../gameState.js";
import { addActivePlayer, broadcastOnlinePlayers, pushAllCharactersToDMs, removeActivePlayer } from "../rosterStore.js";

export function registerJoinHandler(io, socket, session) {
  socket.on(EVENTS.JOIN, ({ mode, name, characterId }) => {
    session.mode = mode === "dm" ? "dm" : "player";
    session.name = (name || "").trim() || "Player";
    session.characterId = characterId || null;
    socket.data.session = session;

    if (session.mode === "player") {
      const db = loadDB();
      const user = db.users[session.name.toLowerCase()];
      const character = user ? user.characters.find((c) => c.id === session.characterId) : null;

      addActivePlayer(socket.id, session.name, character);
      if (character) socket.emit(EVENTS.YOUR_CHARACTER, character);
    }

    socket.emit(EVENTS.JOINED, { mode: session.mode, name: session.name });
    socket.emit(EVENTS.STATE, getState());

    broadcastOnlinePlayers(io);
    pushAllCharactersToDMs(io); // refresh every connected DM's roster — covers
    // first joins AND reconnects

    socket.broadcast.emit(EVENTS.PRESENCE, {
      message: `${session.name} connected as ${session.mode.toUpperCase()}`,
    });
  });

  socket.on("disconnect", () => {
    removeActivePlayer(socket.id);
    broadcastOnlinePlayers(io);
    pushAllCharactersToDMs(io);
    if (session.name) {
      socket.broadcast.emit(EVENTS.PRESENCE, { message: `${session.name} disconnected` });
    }
  });
}
