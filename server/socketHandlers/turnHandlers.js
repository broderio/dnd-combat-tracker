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
