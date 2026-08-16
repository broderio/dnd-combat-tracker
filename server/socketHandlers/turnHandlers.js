// server/socketHandlers/turnHandlers.js
//
// DM-only: manage the initiative/turn-order tracker. Like grid/tokens, the
// turn order is part of the broadcast `state`, so both events just mutate
// gameState and re-broadcast the full state — every client (DM and players)
// renders the same "whose turn is it" banner from that.

import { EVENTS } from '../../shared/protocol.js';
import { PermissionPolicy } from '../policy.js';

export class TurnHandlers {
  constructor(io, socket, session, gameStateStore) {
    this.io = io;
    this.socket = socket;
    this.session = session;
    this.gameState = gameStateStore;
  }

  register() {
    this.socket.on(EVENTS.SET_TURN_ORDER, (combatants) => {
      if (!PermissionPolicy.canManageBoard(this.session)) return;
      this.gameState.setTurnOrder(combatants);
      this.io.emit(EVENTS.STATE, this.gameState.getState());
    });

    this.socket.on(EVENTS.NEXT_TURN, () => {
      if (!PermissionPolicy.canManageBoard(this.session)) return;
      this.gameState.nextTurn();
      this.io.emit(EVENTS.STATE, this.gameState.getState());
    });
  }
}
