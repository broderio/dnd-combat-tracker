// server/socketHandlers/gridHandler.js
import { EVENTS } from "../../shared/protocol.js";
import { getState, setGrid } from "../gameState.js";
import { canManageBoard } from "../policy.js";

export function registerGridHandler(io, socket, session) {
  socket.on(EVENTS.SET_GRID, (grid) => {
    if (!canManageBoard(session)) return;
    setGrid(grid);
    io.emit(EVENTS.STATE, getState());
  });
}
