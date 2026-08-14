// server/socketHandlers/tokenHandlers.js
import { EVENTS } from "../../shared/protocol.js";
import { addToken, getState, getToken, moveToken, removeToken } from "../gameState.js";
import { canManageBoard, canMoveToken } from "../policy.js";

export function registerTokenHandlers(io, socket, session) {
  socket.on(EVENTS.ADD_TOKEN, (token) => {
    if (!canManageBoard(session)) return;
    addToken(token);
    io.emit(EVENTS.STATE, getState());
  });

  socket.on(EVENTS.REMOVE_TOKEN, (id) => {
    if (!canManageBoard(session)) return;
    removeToken(id);
    io.emit(EVENTS.STATE, getState());
  });

  socket.on(EVENTS.MOVE_TOKEN, ({ id, col, row }) => {
    const token = getToken(id);
    if (!token) return;
    if (!canMoveToken(session, token)) return; // players may only move their own token

    const moved = moveToken(id, col, row);
    io.emit(EVENTS.TOKEN_MOVED, { id, col: moved.col, row: moved.row });
  });
}
