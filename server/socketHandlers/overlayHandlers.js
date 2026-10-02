import { EVENTS } from '../../shared/protocol.js';
import { BaseSocketHandler } from './baseSocketHandler.js';

export class OverlayHandlers extends BaseSocketHandler {
  register() {
    this.socket.on(EVENTS.ADD_OVERLAY, (overlay) => {
      if (!this.guard()) return;
      this.gameState.addOverlay(overlay);
      this.broadcastState();
    });

    this.socket.on(EVENTS.REMOVE_OVERLAY, (id) => {
      if (!this.guard()) return;
      this.gameState.removeOverlay(id);
      this.broadcastState();
    });
  }
}
