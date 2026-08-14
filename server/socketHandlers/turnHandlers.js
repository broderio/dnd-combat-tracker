// server/socketHandlers/turnHandlers.js
//
// DM-only: manage the initiative/turn-order tracker. Like grid/tokens, the
// turn order is part of the broadcast `state`, so both events just mutate
// gameState and re-broadcast the full state — every client (DM and players)
// renders the same "whose turn is it" banner from that.

import { EVENTS } from "../../shared/protocol.js";
import { getState, nextTurn, setTurnOrder } from "../gameState.js";
import { canManageBoard } from "../policy.js";

export function registerTurnHandlers(io, socket, session) {
  socket.on(EVENTS.SET_TURN_ORDER, (combatants) => {
    if (!canManageBoard(session)) return;
    setTurnOrder(combatants);
    io.emit(EVENTS.STATE, getState());
  });

  socket.on(EVENTS.NEXT_TURN, () => {
    if (!canManageBoard(session)) return;
    nextTurn();
    io.emit(EVENTS.STATE, getState());
  });
}
