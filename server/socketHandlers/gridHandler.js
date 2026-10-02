import { EVENTS } from '../../shared/protocol.js';
import { BaseSocketHandler } from './baseSocketHandler.js';

export class GridHandler extends BaseSocketHandler {
  register() {
    this.socket.on(EVENTS.SET_GRID, (grid) => {
      if (!this.guard()) return;
      this.gameState.setGrid(grid);
      this.broadcastState();
    });
  }
}
