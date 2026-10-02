import { EVENTS } from '../../shared/protocol.js';
import { BaseSocketHandler } from './baseSocketHandler.js';

export class TurnHandlers extends BaseSocketHandler {
  register() {
    this.socket.on(EVENTS.SET_TURN_ORDER, (combatants) => {
      if (!this.guard()) return;
      this.gameState.setTurnOrder(combatants);
      this.broadcastState();
    });

    this.socket.on(EVENTS.NEXT_TURN, () => {
      if (!this.guard()) return;
      this.gameState.nextTurn();
      this.broadcastState();
    });
  }
}
