import { EVENTS } from '../../shared/protocol.js';
import { PermissionPolicy } from '../policy.js';

export class OverlayHandlers {
  constructor(io, socket, session, gameStateStore) {
    this.io = io;
    this.socket = socket;
    this.session = session;
    this.gameState = gameStateStore;
  }

  register() {
    this.socket.on(EVENTS.ADD_OVERLAY, (overlay) => {
      if (!PermissionPolicy.canManageBoard(this.session)) return;
      this.gameState.addOverlay(overlay);
      this.io.emit(EVENTS.STATE, this.gameState.getState());
    });

    this.socket.on(EVENTS.REMOVE_OVERLAY, (id) => {
      if (!PermissionPolicy.canManageBoard(this.session)) return;
      this.gameState.removeOverlay(id);
      this.io.emit(EVENTS.STATE, this.gameState.getState());
    });
  }
}
